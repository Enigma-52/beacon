import { pool } from '../services/db';

export type RepoStatus = 'pending' | 'fetching' | 'analyzing' | 'done' | 'error';

export interface Repo {
  id: number;
  url: string;
  github_data: unknown;
  status: RepoStatus;
  created_at: Date;
}

export async function findRepoById(id: number): Promise<Repo | null> {
  const result = await pool.query<Repo>(
    'SELECT id, url, status, github_data, created_at FROM repos WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findRepoByUrl(url: string): Promise<Repo | null> {
  const result = await pool.query<Repo>(
    'SELECT id, url, status, github_data, created_at FROM repos WHERE url = $1',
    [url]
  );
  return result.rows[0] ?? null;
}

export async function upsertRepo(url: string): Promise<Pick<Repo, 'id' | 'status'>> {
  const result = await pool.query<Pick<Repo, 'id' | 'status'>>(
    `INSERT INTO repos (url, status)
     VALUES ($1, 'pending')
     ON CONFLICT (url) DO UPDATE SET status = 'pending', created_at = NOW()
     RETURNING id, status`,
    [url]
  );
  return result.rows[0];
}

export async function updateRepoStatus(id: number, status: RepoStatus): Promise<void> {
  await pool.query('UPDATE repos SET status = $1 WHERE id = $2', [status, id]);
}

export async function updateRepoGithubData(id: number, github_data: unknown): Promise<void> {
  await pool.query('UPDATE repos SET github_data = $2 WHERE id = $1', [id, JSON.stringify(github_data)]);
}
