/**
 * GitHub API tool definitions (OpenAI tool-call format) and executors.
 * Tools are pre-bound to a specific owner/repo — the agent doesn't need to re-specify them.
 */

const GITHUB_API = 'https://api.github.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/** Only attach auth header if the token looks real (not a placeholder). */
function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'beacon-app',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token && token.startsWith('gh')) {
    h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

async function ghGet<T = Raw>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function decodeContent(raw: Raw): string {
  if (raw.encoding === 'base64' && raw.content) {
    return Buffer.from(raw.content as string, 'base64').toString('utf-8').slice(0, 6000);
  }
  return '';
}

// ─── Tool executors ────────────────────────────────────────────────────────────

export async function getRepoInfo(owner: string, repo: string): Promise<Raw> {
  const d = await ghGet(`/repos/${owner}/${repo}`);
  return {
    name: d.name,
    description: d.description,
    stars: d.stargazers_count,
    forks: d.forks_count,
    language: d.language,
    license: d.license?.spdx_id ?? null,
    open_issues: d.open_issues_count,
    default_branch: d.default_branch,
    created_at: d.created_at,
    pushed_at: d.pushed_at,
    topics: d.topics,
  };
}

export async function listIssues(owner: string, repo: string, limit = 30): Promise<Raw[]> {
  const issues = await ghGet<Raw[]>(`/repos/${owner}/${repo}/issues?state=open&per_page=${limit}&sort=created`);
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      body: (i.body as string | null)?.slice(0, 500) ?? null,
      labels: (i.labels as Raw[]).map((l) => l.name),
      comments: i.comments,
      created_at: i.created_at,
      author: i.user?.login ?? null,
    }));
}

export async function listMergedPrs(owner: string, repo: string, limit = 20): Promise<Raw[]> {
  const prs = await ghGet<Raw[]>(`/repos/${owner}/${repo}/pulls?state=closed&sort=updated&per_page=${limit}`);
  return prs
    .filter((p) => p.merged_at)
    .map((p) => ({
      number: p.number,
      title: p.title,
      merged_at: p.merged_at,
      author: p.user?.login ?? null,
      reviewers: (p.requested_reviewers as Raw[]).map((r) => r.login),
      merge_time_hours: Math.round(
        (new Date(p.merged_at as string).getTime() - new Date(p.created_at as string).getTime()) / 3_600_000
      ),
    }));
}

export async function getPrDetails(owner: string, repo: string, prNumber: number): Promise<Raw> {
  const [pr, files, reviews] = await Promise.all([
    ghGet(`/repos/${owner}/${repo}/pulls/${prNumber}`),
    ghGet<Raw[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/files`),
    ghGet<Raw[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`),
  ]);
  return {
    number: pr.number,
    title: pr.title,
    body: (pr.body as string | null)?.slice(0, 800) ?? null,
    author: pr.user?.login ?? null,
    merged_at: pr.merged_at,
    files_changed: (files as Raw[]).map((f) => ({ filename: f.filename, status: f.status, changes: f.changes })),
    reviews: (reviews as Raw[]).map((r) => ({ reviewer: r.user?.login, state: r.state })),
  };
}

export async function listContributors(owner: string, repo: string): Promise<Raw[]> {
  const data = await ghGet<Raw[]>(`/repos/${owner}/${repo}/contributors?per_page=15`);
  return data.map((c) => ({ login: c.login, contributions: c.contributions }));
}

export async function getFileTree(owner: string, repo: string): Promise<string[]> {
  const data = await ghGet<Raw>(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`).catch(() => ({ tree: [] }));
  return ((data.tree as Raw[]) ?? [])
    .map((f) => f.path as string)
    .filter((p) => p.split('/').length <= 3)
    .slice(0, 150);
}

export async function getFileContent(owner: string, repo: string, path: string): Promise<Raw> {
  const data = await ghGet(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`);
  return { path, content: decodeContent(data as Raw), size: (data as Raw).size };
}

export async function getReadme(owner: string, repo: string): Promise<{ content: string }> {
  const data = await ghGet(`/repos/${owner}/${repo}/readme`).catch(() => null);
  return { content: data ? decodeContent(data as Raw) : '' };
}
