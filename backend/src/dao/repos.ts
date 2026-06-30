import { pool } from '../services/db';

export type RepoStatus = 'pending' | 'fetching' | 'analyzing' | 'done' | 'error';

export interface Repo {
  id: number;
  url: string;
  github_data: unknown;
  status: RepoStatus;
  created_at: Date;
  updated_at: Date;
}

export async function findRepoById(id: number): Promise<Repo | null> {
  const result = await pool.query<Repo>(
    'SELECT id, url, status, github_data, created_at, updated_at FROM repos WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findRepoByUrl(url: string): Promise<Repo | null> {
  const result = await pool.query<Repo>(
    'SELECT id, url, status, github_data, created_at, updated_at FROM repos WHERE url = $1',
    [url]
  );
  return result.rows[0] ?? null;
}

export async function upsertRepo(url: string): Promise<Pick<Repo, 'id' | 'status'>> {
  const result = await pool.query<Pick<Repo, 'id' | 'status'>>(
    `INSERT INTO repos (url, status)
     VALUES ($1, 'pending')
     ON CONFLICT (url) DO UPDATE SET status = 'pending', updated_at = NOW()
     RETURNING id, status`,
    [url]
  );
  return result.rows[0];
}

export async function updateRepoStatus(id: number, status: RepoStatus): Promise<void> {
  await pool.query('UPDATE repos SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
}

export async function updateRepoGithubData(id: number, github_data: unknown): Promise<void> {
  await pool.query('UPDATE repos SET github_data = $2, updated_at = NOW() WHERE id = $1', [id, JSON.stringify(github_data)]);
}

export interface FeedRepo {
  id: number;
  url: string;
  status: RepoStatus;
  github_data: unknown;
  updated_at: Date;
  analysis: unknown;
}

export async function findAllDoneRepos(): Promise<FeedRepo[]> {
  const result = await pool.query<FeedRepo>(`
    SELECT r.id, r.url, r.status, r.github_data, r.updated_at, rp.analysis
    FROM repos r
    LEFT JOIN LATERAL (
      SELECT analysis FROM reports WHERE repo_id = r.id ORDER BY created_at DESC LIMIT 1
    ) rp ON true
    WHERE r.status = 'done'
    ORDER BY r.updated_at DESC
  `);
  return result.rows;
}
