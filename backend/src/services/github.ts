import type { GithubData, GithubIssue, GithubPR, Contributor } from '../schemas';
import { parseGitHubUrl } from '../utils/validation';
import { log } from './logger';

const GITHUB_API = 'https://api.github.com';

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'beacon-app',
  };
  if (process.env.GITHUB_TOKEN) {
    h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export async function fetchGitHubData(url: string): Promise<GithubData> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('invalid GitHub URL');

  const { owner, repo } = parsed;
  const base = `/repos/${owner}/${repo}`;

  log.info({ owner, repo }, 'fetching GitHub data');

  const [repoMeta, rawIssues, rawPRs, rawContributors, rawTree, rawReadme] = await Promise.all([
    get<Raw>(base),
    get<Raw[]>(`${base}/issues?state=open&per_page=30&sort=created`),
    get<Raw[]>(`${base}/pulls?state=closed&sort=updated&per_page=20`),
    get<Raw[]>(`${base}/contributors?per_page=10`),
    get<Raw>(`${base}/git/trees/HEAD?recursive=1`).catch(() => ({ tree: [] })),
    get<Raw>(`${base}/readme`).catch(() => null),
  ]);

  log.info(
    { owner, repo, issues: rawIssues.length, prs: rawPRs.length, contributors: rawContributors.length },
    'raw data fetched'
  );

  const issues: GithubIssue[] = rawIssues
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number as number,
      title: i.title as string,
      labels: (i.labels as Raw[]).map((l) => l.name as string),
      comments: i.comments as number,
      created_at: i.created_at as string,
    }));

  const prs: GithubPR[] = rawPRs
    .filter((p) => p.merged_at)
    .map((p) => {
      const mergeMs = p.merged_at
        ? new Date(p.merged_at as string).getTime() - new Date(p.created_at as string).getTime()
        : null;
      return {
        number: p.number as number,
        title: p.title as string,
        merged_at: p.merged_at as string | null,
        files_changed: (p.changed_files ?? 0) as number,
        reviewer: ((p.requested_reviewers as Raw[])[0]?.login ?? null) as string | null,
        merge_time_hours: mergeMs !== null ? Math.round(mergeMs / 3_600_000) : null,
      };
    });

  const contributors: Contributor[] = rawContributors.map((c) => ({
    login: c.login as string,
    contributions: c.contributions as number,
  }));

  const fileTree: string[] = ((rawTree.tree as Raw[]) ?? [])
    .map((f) => f.path as string)
    .filter((p) => p.split('/').length <= 2)
    .slice(0, 100);

  let readme = '';
  if (rawReadme?.content) {
    readme = Buffer.from(rawReadme.content as string, 'base64').toString('utf-8').slice(0, 3000);
  }

  log.info({ owner, repo, issues: issues.length, prs: prs.length, paths: fileTree.length }, 'github fetch complete');

  return {
    metadata: {
      name: repoMeta.name as string,
      description: (repoMeta.description ?? null) as string | null,
      stars: repoMeta.stargazers_count as number,
      forks: repoMeta.forks_count as number,
      language: (repoMeta.language ?? null) as string | null,
      license: (repoMeta.license?.spdx_id ?? null) as string | null,
      open_issues: repoMeta.open_issues_count as number,
    },
    issues,
    pull_requests: prs,
    contributors,
    file_tree: fileTree,
    readme,
  };
}
