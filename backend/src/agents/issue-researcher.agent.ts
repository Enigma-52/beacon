import Ajv from 'ajv';
import { IssueResearchSchema } from '../schemas/issue-research.schema';
import type { IssueResearch } from '../schemas/issue-research.schema';
import { log } from '../services/logger';
import type { AgentEmitter } from './events';

const ajv = new Ajv({ strict: false });
const validateResearch = ajv.compile(IssueResearchSchema);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const GITHUB_API = 'https://api.github.com';
const MAX_ITERATIONS = 12;
const MAX_CONSECUTIVE_ERRORS = 3;

const noopEmitter: AgentEmitter = () => {};

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
    .map((c) => `@${(c.user as Raw | null)?.login ?? 'unknown'}: ${(c.body as string | null)?.slice(0, 400) ?? ''}`)
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
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, { headers: buildHeaders() });
  if (res.status === 404) {
    // File doesn't exist at HEAD (common with changelog/temp files from PRs) — not a tool failure
    return JSON.stringify({ note: `File not found at HEAD: ${path}. It may have been added or deleted in a past PR. Skip this file.` });
  }
  if (!res.ok) throw new Error(`GitHub → ${res.status}`);
  const data = await res.json() as Raw;
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content as string, 'base64').toString('utf-8').slice(0, 4000);
  }
  return '';
}

function toolSummary(name: string, content: string): string {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (name === 'get_issue_full') {
      const p = parsed as { title?: string };
      return `issue: ${p.title ?? 'loaded'}`;
    }
    if (name === 'search_similar_prs') {
      const p = parsed as unknown[];
      return `${p.length} similar PR${p.length !== 1 ? 's' : ''} found`;
    }
    if (name === 'get_pr_changed_files') {
      const p = parsed as unknown[];
      return `${p.length} file${p.length !== 1 ? 's' : ''} changed`;
    }
    if (name === 'get_file_content') {
      return `file read (${content.length} chars)`;
    }
  } catch { /* ignore */ }
  return 'ok';
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
        properties: { query: { type: 'string' } },
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
      description: 'Read a file from the repo',
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
      description: 'Output the completed issue research. Call this when you have enough context.',
      parameters: {
        type: 'object',
        required: ['summary', 'approach', 'files_to_change', 'similar_prs', 'effort_estimate', 'reviewer_to_ping'],
        properties: {
          summary: { type: 'string' },
          approach: { type: 'string' },
          files_to_change: {
            type: 'array',
            items: {
              type: 'object',
              required: ['path', 'reason', 'url'],
              properties: { path: { type: 'string' }, reason: { type: 'string' }, url: { type: 'string' } },
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
          reviewer_to_ping: { type: 'string' },
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
  issueNumber: number,
  emit: AgentEmitter = noopEmitter,
  signal: AbortSignal = new AbortController().signal
): Promise<IssueResearch> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  log.info({ owner, repo, issueNumber }, 'issue researcher agent started');
  emit({ type: 'research_started', owner, repo, issueNumber });

  const systemPrompt = `You are a deep issue researcher for the GitHub repo ${owner}/${repo}.

Your task: research issue #${issueNumber} and produce a concrete guide for a new contributor.

Strategy (follow in order, don't skip steps):
1. Call get_issue_full to read the issue and discussion.
2. Call search_similar_prs with 2-3 keywords from the issue title to find related merged PRs.
3. Call get_pr_changed_files on the most relevant PR to see which files were changed.
4. Optionally call get_file_content on 1-2 key files to understand the code structure.
5. Call produce_issue_research with your findings.

Important: call produce_issue_research as soon as you have enough context — do not keep calling tools indefinitely.

For files_to_change URL: https://github.com/${owner}/${repo}/blob/HEAD/{path}
For reviewer_to_ping: use the GitHub profile URL of a specific individual contributor (not the org). Pick the person who authored or reviewed the most similar merged PRs: https://github.com/{login}`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Research issue #${issueNumber} in ${owner}/${repo}. Follow the strategy and call produce_issue_research when done.` },
  ];

  let consecutiveErrors = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) {
      const msg = 'Issue research cancelled';
      emit({ type: 'research_error', message: msg });
      throw new Error(msg);
    }

    // Warn LLM when getting close to the limit
    if (i === MAX_ITERATIONS - 3) {
      messages.push({
        role: 'user',
        content: 'You have a few iterations left. Call produce_issue_research now with what you know. Use your best judgment where data is missing.',
      });
    }

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/beacon',
        'X-Title': 'Beacon',
      },
      body: JSON.stringify({ model, messages, tools: RESEARCHER_TOOLS, tool_choice: 'auto', temperature: 0.1 }),
      signal,
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

    const data = await res.json() as {
      choices: { message: { role: string; content: string | null; tool_calls?: Message['tool_calls'] }; finish_reason: string }[];
    };
    const choice = data.choices[0];

    messages.push({ role: 'assistant', content: choice.message.content, tool_calls: choice.message.tool_calls });

    if (choice.finish_reason === 'stop') {
      messages.push({ role: 'user', content: 'Call produce_issue_research with your findings now.' });
      continue;
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        const name = tc.function.name;
        const args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;

        emit({ type: 'tool_call', name, args });

        if (name === 'produce_issue_research') {
          if (!validateResearch(args)) {
            const msg = `produce_issue_research schema error: ${JSON.stringify(validateResearch.errors)}`;
            emit({ type: 'research_error', message: msg });
            throw new Error(msg);
          }
          log.info({ owner, repo, issueNumber, iterations: i + 1 }, 'issue research complete');
          // research_done emitted by route after DB save to avoid race condition
          return args as IssueResearch;
        }

        let content = '';
        let success = true;
        try {
          if (name === 'get_issue_full') content = await getIssueFull(owner, repo, args.issue_number as number);
          else if (name === 'search_similar_prs') content = await searchSimilarPrs(owner, repo, args.query as string);
          else if (name === 'get_pr_changed_files') content = await getPrChangedFiles(owner, repo, args.pr_number as number);
          else if (name === 'get_file_content') content = await getFileContent(owner, repo, args.path as string);
          else { content = JSON.stringify({ error: `unknown tool: ${name}` }); success = false; }
        } catch (err) {
          content = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
          success = false;
        }

        if (!success) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            messages.push({ role: 'tool', tool_call_id: tc.id, content });
            messages.push({
              role: 'user',
              content: 'Several tools have failed. Call produce_issue_research now with your best assessment. Use "unknown" where data is unavailable.',
            });
            emit({ type: 'tool_result', name, success: false, summary: `error: ${JSON.parse(content).error as string}` });
            consecutiveErrors = 0;
            break;
          }
        } else {
          consecutiveErrors = 0;
        }

        emit({ type: 'tool_result', name, success, summary: success ? toolSummary(name, content) : `error: ${(JSON.parse(content) as { error: string }).error}` });
        messages.push({ role: 'tool', tool_call_id: tc.id, content });
      }
    }
  }

  const msg = `Issue researcher exceeded ${MAX_ITERATIONS} iterations`;
  emit({ type: 'research_error', message: msg });
  throw new Error(msg);
}
