/**
 * Contributor Matcher — single LLM call.
 * Takes the contributor's skills/languages/level and all cached issues,
 * returns the top N issues across all repos ranked by fit.
 */
import type { RankedIssue } from '../schemas';
import { log } from '../services/logger';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export interface ContributorProfile {
  skills: string[];        // e.g. ['TypeScript', 'React', 'Node.js']
  level: 'beginner' | 'intermediate' | 'advanced';
  interests?: string[];    // e.g. ['testing', 'documentation', 'performance']
}

export interface MatchedIssue {
  repo_url: string;
  repo_id: number;
  issue: RankedIssue;
  fit_score: number;       // 1-10
  fit_reason: string;
}

interface CachedRepo {
  id: number;
  url: string;
  issues: RankedIssue[];
}

export async function runContributorMatcher(
  profile: ContributorProfile,
  repos: CachedRepo[]
): Promise<MatchedIssue[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  // Flatten all issues with repo context
  const allIssues = repos.flatMap((r) =>
    r.issues.map((issue) => ({
      repo_id: r.id,
      repo_url: r.url,
      repo_name: r.url.replace('https://github.com/', ''),
      issue_number: issue.number,
      issue_title: issue.title,
      issue_url: issue.github_url,
      difficulty: issue.difficulty,
      signals: issue.signals,
    }))
  );

  if (allIssues.length === 0) return [];

  log.info({ total: allIssues.length, level: profile.level }, 'contributor matcher started');

  const prompt = `You are a contributor matching engine. Given a contributor's profile and a list of open GitHub issues, return the top 10 best-fit issues as JSON.

Contributor profile:
- Skills: ${profile.skills.join(', ')}
- Experience level: ${profile.level}
- Interests: ${profile.interests?.join(', ') ?? 'any'}

Available issues (${allIssues.length} total):
${JSON.stringify(allIssues, null, 2)}

Return a JSON array of the top 10 matches. Each item must have:
- repo_id (number)
- repo_url (string)
- issue_number (number)
- fit_score (1-10, where 10 is perfect fit)
- fit_reason (one sentence explaining why this is a good match)

Prioritize: difficulty match to level, skill relevance, fresh issues (is_fresh=true), issues with no comments (easier to claim).
Return ONLY valid JSON, no markdown.`;

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
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

  const data = await res.json() as { choices: { message: { content: string } }[] };
  const raw = JSON.parse(data.choices[0].message.content) as { matches?: unknown[] } | unknown[];

  const matches = (Array.isArray(raw) ? raw : (raw as { matches?: unknown[] }).matches ?? []) as {
    repo_id: number;
    repo_url: string;
    issue_number: number;
    fit_score: number;
    fit_reason: string;
  }[];

  // Re-attach full issue data
  const issueMap = new Map(allIssues.map((i) => [`${i.repo_id}:${i.issue_number}`, i]));
  const repoIssueMap = new Map(
    repos.flatMap((r) => r.issues.map((issue) => [`${r.id}:${issue.number}`, issue]))
  );

  return matches
    .map((m) => {
      const key = `${m.repo_id}:${m.issue_number}`;
      const meta = issueMap.get(key);
      const issue = repoIssueMap.get(key);
      if (!meta || !issue) return null;
      return {
        repo_url: meta.repo_url,
        repo_id: meta.repo_id,
        issue,
        fit_score: m.fit_score,
        fit_reason: m.fit_reason,
      };
    })
    .filter((m): m is MatchedIssue => m !== null)
    .sort((a, b) => b.fit_score - a.fit_score);
}
