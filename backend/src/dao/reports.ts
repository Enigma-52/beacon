import { pool } from '../services/db';

export interface Report {
  id: number;
  repo_id: number;
  analysis: {
    issues?: unknown;
    architecture?: unknown;
    health?: unknown;
    starting_points?: unknown;
  } | null;
  created_at: Date;
}

export async function findReportByRepoId(repo_id: number): Promise<Report | null> {
  const result = await pool.query<Report>(
    'SELECT id, repo_id, analysis, created_at FROM reports WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 1',
    [repo_id]
  );
  return result.rows[0] ?? null;
}

export async function insertReport(repo_id: number, analysis: Report['analysis']): Promise<Report> {
  const result = await pool.query<Report>(
    'INSERT INTO reports (repo_id, analysis) VALUES ($1, $2) RETURNING id, repo_id, analysis, created_at',
    [repo_id, JSON.stringify(analysis)]
  );
  return result.rows[0];
}

export async function updateReport(id: number, analysis: Report['analysis']): Promise<void> {
  await pool.query('UPDATE reports SET analysis = $2 WHERE id = $1', [id, JSON.stringify(analysis)]);
}
