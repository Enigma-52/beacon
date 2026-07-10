import { Router, Request, Response } from 'express';
import { pool } from '../services/db';
import { asyncRoute } from '../middleware/errors';

export const statsRouter = Router();

/** Platform-wide stats for the feed header. */
statsRouter.get(
  '/stats',
  asyncRoute(async (_req: Request, res: Response) => {
    const result = await pool.query<{
      repos: string;
      reports: string;
      issues_ranked: string;
      research_runs: string;
      total_tokens: string | null;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM repos WHERE status = 'done')                          AS repos,
        (SELECT COUNT(*) FROM reports)                                              AS reports,
        (SELECT COALESCE(SUM(jsonb_array_length(analysis->'issues')), 0)
           FROM reports WHERE analysis ? 'issues')                                  AS issues_ranked,
        (SELECT COUNT(*) FROM issue_research)                                       AS research_runs,
        (SELECT SUM((meta->>'total_tokens')::bigint) FROM reports WHERE meta IS NOT NULL) AS total_tokens
    `);

    const row = result.rows[0];
    res.json({
      repos: Number(row.repos),
      reports: Number(row.reports),
      issues_ranked: Number(row.issues_ranked),
      research_runs: Number(row.research_runs),
      total_tokens: row.total_tokens ? Number(row.total_tokens) : 0,
    });
  })
);
