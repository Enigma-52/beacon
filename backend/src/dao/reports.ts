import { pool } from '../services/db';

export interface ReportMeta {
  model?: string;
  iterations?: number;
  total_tokens?: number;
  duration_ms?: number;
}

export interface Report {
  id: number;
  repo_id: number;
  analysis: {
    issues?: unknown;
    architecture?: unknown;
    health?: unknown;
    starting_points?: unknown;
  } | null;
  meta: ReportMeta | null;
  created_at: Date;
}

export async function findReportByRepoId(repo_id: number): Promise<Report | null> {
  const result = await pool.query<Report>(
    'SELECT id, repo_id, analysis, meta, created_at FROM reports WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 1',
    [repo_id]
  );
  return result.rows[0] ?? null;
}

export async function insertReport(
  repo_id: number,
  analysis: Report['analysis'],
  meta: ReportMeta | null = null
): Promise<Report> {
  const result = await pool.query<Report>(
    'INSERT INTO reports (repo_id, analysis, meta) VALUES ($1, $2, $3) RETURNING id, repo_id, analysis, meta, created_at',
    [repo_id, JSON.stringify(analysis), meta ? JSON.stringify(meta) : null]
  );
  return result.rows[0];
}

export interface ReportSummary {
  id: number;
  meta: ReportMeta | null;
  created_at: Date;
}

/** Analysis history for a repo — meta only, newest first. */
export async function listReportsByRepo(repo_id: number): Promise<ReportSummary[]> {
  const result = await pool.query<ReportSummary>(
    'SELECT id, meta, created_at FROM reports WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 20',
    [repo_id]
  );
  return result.rows;
}

export async function updateReport(id: number, analysis: Report['analysis']): Promise<void> {
  await pool.query('UPDATE reports SET analysis = $2 WHERE id = $1', [id, JSON.stringify(analysis)]);
}
