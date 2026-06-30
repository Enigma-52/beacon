import Ajv from 'ajv';
import type { GithubData, Analysis } from '../schemas';
import { AnalysisSchema } from '../schemas';
import { log } from './logger';

const ajv = new Ajv({ strict: false });
const validateAnalysis = ajv.compile(AnalysisSchema);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

function buildPrompt(data: GithubData): string {
  return `You are analyzing the GitHub repository "${data.metadata.name}" to help open source contributors navigate it.

Repository info:
- Description: ${data.metadata.description ?? 'none'}
- Stars: ${data.metadata.stars}, Forks: ${data.metadata.forks}
- Primary language: ${data.metadata.language ?? 'unknown'}
- License: ${data.metadata.license ?? 'unknown'}
- Open issues: ${data.metadata.open_issues}

Top open issues (up to 30):
${JSON.stringify(data.issues.slice(0, 30), null, 2)}

Recent merged PRs (up to 20):
${JSON.stringify(data.pull_requests.slice(0, 20), null, 2)}

Top contributors:
${JSON.stringify(data.contributors, null, 2)}

File tree (top 2 levels):
${data.file_tree.join('\n')}

README (first 3000 chars):
${data.readme}

Respond with ONLY a JSON object matching exactly this structure — no markdown, no extra keys:
{
  "issues": [ { "number": <int>, "title": <str>, "score": <1-10>, "reason": <str>, "difficulty": "beginner"|"intermediate"|"advanced" } ],
  "architecture": { "summary": <str>, "key_modules": [<str>], "ownership": { "<module>": ["<contributor>"] } },
  "health": { "summary": <str>, "activity": <str>, "pr_merge_speed": <str>, "contributor_concentration": <str>, "trend": "growing"|"stable"|"declining"|"unknown" },
  "starting_points": [ { "path": <str>, "reason": <str> } ]
}

Rules:
- issues: rank ALL issues by approachability score (1=hardest, 10=easiest). Include up to 10.
- architecture.ownership: map module/directory → list of contributors who touch it most.
- starting_points: 3–5 files/docs a new contributor should read first.
`;
}

export async function analyzeWithOpenRouter(data: GithubData): Promise<Analysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  log.info({ model }, 'starting OpenRouter analysis');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/beacon',
      'X-Title': 'Beacon',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(data) }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw: unknown = JSON.parse(json.choices[0].message.content);

  log.info('OpenRouter response received, validating schema');

  if (!validateAnalysis(raw)) {
    log.error({ errors: validateAnalysis.errors }, 'analysis schema validation failed');
    throw new Error(`Analysis response failed schema validation: ${JSON.stringify(validateAnalysis.errors)}`);
  }

  log.info('analysis schema valid');
  return raw as Analysis;
}
