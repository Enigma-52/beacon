import Ajv from 'ajv';
import { IssueResearchSchema } from '../schemas/issue-research.schema';
import type { IssueResearch } from '../schemas/issue-research.schema';
import { log } from '../services/logger';

const ajv = new Ajv({ strict: false });
const validateResearch = ajv.compile(IssueResearchSchema);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const GITHUB_API = 'https://api.github.com';

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'beacon-app' };
  const token = process.env.GITHUB_TOKEN;
  if (token && token.startsWith('gh')) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function ghGet<T = Record<string, unknown>>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

type Raw = Record<string, unknown>;

async function getIssueFull(owner: string, repo: string, issueNumber: number): Promise<string> {
  const [issue, comments] = await Promise.all([
    ghGet<Raw>(`/repos/${owner}/${repo}/issues/${issueNumber}`),
    ghGet<Raw[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`),
  ]);
  const body = (issue.body as string | null)?.slice(0, 2000) ?? '';
  const commentText = (comments as Raw[])
    .slice(0, 10)
    .map((c) => `@${c.user && (c.user as Raw).login}: ${(c.body as string | null)?.slice(0, 400) ?? ''}`)
    .join('\n');
  return JSON.stringify({ title: issue.title, body, labels: issue.labels, comments: commentText });
}

async function searchSimilarPrs(owner: string, repo: string, query: string): Promise<string> {
  const q = encodeURIComponent(`repo:${owner}/${repo} is:pr is:merged ${query}`);
  const data = await ghGet<{ items: Raw[] }>(`/search/issues?q=${q}&per_page=5`).catch(() => ({ items: [] }));
  return JSON.stringify(
    data.items.map((p) => ({
      number: p.number,
      title: p.title,
      url: `https://github.com/${owner}/${repo}/pull/${p.number}`,
    }))
  );
}

async function getPrChangedFiles(owner: string, repo: string, prNumber: number): Promise<string> {
  const files = await ghGet<Raw[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/files`).catch(() => []);
  return JSON.stringify((files as Raw[]).map((f) => ({ filename: f.filename, status: f.status })));
}

async function getFileContent(owner: string, repo: string, path: string): Promise<string> {
  const data = await ghGet<Raw>(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`);
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content as string, 'base64').toString('utf-8').slice(0, 4000);
  }
  return '';
}

const RESEARCHER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_issue_full',
      description: 'Get full issue body and all comments',
      parameters: {
        type: 'object',
        required: ['issue_number'],
        properties: { issue_number: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_similar_prs',
      description: 'Search for merged PRs similar to this issue by keyword',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: { query: { type: 'string', description: 'keywords from the issue title/body' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pr_changed_files',
      description: 'Get list of files changed in a PR',
      parameters: {
        type: 'object',
        required: ['pr_number'],
        properties: { pr_number: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_content',
      description: 'Read a file from the repo to understand the relevant code',
      parameters: {
        type: 'object',
        required: ['path'],
        properties: { path: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'produce_issue_research',
      description: 'Output the completed issue research',
      parameters: {
        type: 'object',
        required: ['summary', 'approach', 'files_to_change', 'similar_prs', 'effort_estimate', 'reviewer_to_ping'],
        properties: {
          summary: { type: 'string', description: 'Plain English — what is this issue asking for?' },
          approach: { type: 'string', description: 'Step-by-step guide for a contributor to fix this' },
          files_to_change: {
            type: 'array',
            items: {
              type: 'object',
              required: ['path', 'reason', 'url'],
              properties: {
                path: { type: 'string' },
                reason: { type: 'string' },
                url: { type: 'string', description: 'Full GitHub URL to the file' },
              },
            },
          },
          similar_prs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['number', 'title', 'url'],
              properties: { number: { type: 'number' }, title: { type: 'string' }, url: { type: 'string' } },
            },
          },
          effort_estimate: { type: 'string', enum: ['hours', 'days', 'week+'] },
          reviewer_to_ping: { type: 'string', description: 'GitHub profile URL of the best maintainer to review this PR' },
        },
      },
    },
  },
] as const;

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export async function runIssueResearcherAgent(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<IssueResearch> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  log.info({ owner, repo, issueNumber }, 'issue researcher agent started');

  const systemPrompt = `You are an expert open source contributor researcher for the GitHub repo ${owner}/${repo}.

Your task: deeply research issue #${issueNumber} and produce a concrete implementation guide for a new contributor.

Strategy:
1. Call get_issue_full to read the issue and its discussion.
2. Call search_similar_prs with keywords from the issue title to find related merged PRs.
3. Call get_pr_changed_files on the most relevant PR to see which files were involved.
4. Call get_file_content on 1-2 key files to understand the relevant code.
5. Call produce_issue_research with your findings.

For files_to_change: include the full GitHub URL: https://github.com/${owner}/${repo}/blob/HEAD/{path}
For reviewer_to_ping: use the full GitHub profile URL: https://github.com/{login}
For effort_estimate: 'hours' = a few hours of work, 'days' = 1-3 days, 'week+' = complex.`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Research issue #${issueNumber} in ${owner}/${repo} and call produce_issue_research when done.` },
  ];

  for (let i = 0; i < 10; i++) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/beacon',
        'X-Title': 'Beacon',
      },
      body: JSON.stringify({ model, messages, tools: RESEARCHER_TOOLS, tool_choice: 'auto', temperature: 0.1 }),
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

    const data = await res.json() as {
      choices: { message: { role: string; content: string | null; tool_calls?: Message['tool_calls'] }; finish_reason: string }[];
    };
    const choice = data.choices[0];

    messages.push({ role: 'assistant', content: choice.message.content, tool_calls: choice.message.tool_calls });

    if (choice.finish_reason === 'stop') {
      messages.push({ role: 'user', content: 'Call produce_issue_research with your findings.' });
      continue;
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        const name = tc.function.name;
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;

        if (name === 'produce_issue_research') {
          if (!validateResearch(args)) {
            throw new Error(`produce_issue_research schema error: ${JSON.stringify(validateResearch.errors)}`);
          }
          log.info({ owner, repo, issueNumber, iterations: i + 1 }, 'issue research complete');
          return args as IssueResearch;
        }

        let content = '';
        try {
          if (name === 'get_issue_full') content = await getIssueFull(owner, repo, args.issue_number as number);
          else if (name === 'search_similar_prs') content = await searchSimilarPrs(owner, repo, args.query as string);
          else if (name === 'get_pr_changed_files') content = await getPrChangedFiles(owner, repo, args.pr_number as number);
          else if (name === 'get_file_content') content = await getFileContent(owner, repo, args.path as string);
          else content = JSON.stringify({ error: `unknown tool: ${name}` });
        } catch (err) {
          content = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }

        messages.push({ role: 'tool', tool_call_id: tc.id, content });
      }
    }
  }

  throw new Error('Issue researcher exceeded max iterations');
}
