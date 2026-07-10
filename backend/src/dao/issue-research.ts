import { pool } from '../services/db';

export interface IssueResearchRecord {
  id: number;
  repo_id: number;
  issue_number: number;
  research: unknown;
  created_at: Date;
}

export async function findIssueResearch(
  repoId: number,
  issueNumber: number
): Promise<IssueResearchRecord | null> {
  const result = await pool.query<IssueResearchRecord>(
    'SELECT * FROM issue_research WHERE repo_id = $1 AND issue_number = $2',
    [repoId, issueNumber]
  );
  return result.rows[0] ?? null;
}

export interface ResearchedIssue {
  issue_number: number;
  effort_estimate: string | null;
  created_at: Date;
}

/** Which issues in a repo already have deep research (for badges). */
export async function listResearchedIssues(repoId: number): Promise<ResearchedIssue[]> {
  const result = await pool.query<ResearchedIssue>(
    `SELECT issue_number, research->>'effort_estimate' AS effort_estimate, created_at
     FROM issue_research WHERE repo_id = $1 ORDER BY issue_number`,
    [repoId]
  );
  return result.rows;
}

/** repo_id → researched issue numbers, across all repos (one query for the feed). */
export async function researchedIssuesByRepo(): Promise<Map<number, number[]>> {
  const result = await pool.query<{ repo_id: number; issue_numbers: number[] }>(
    'SELECT repo_id, array_agg(issue_number) AS issue_numbers FROM issue_research GROUP BY repo_id'
  );
  return new Map(result.rows.map((r) => [r.repo_id, r.issue_numbers]));
}

export async function upsertIssueResearch(
  repoId: number,
  issueNumber: number,
  research: unknown
): Promise<IssueResearchRecord> {
  const result = await pool.query<IssueResearchRecord>(
    `INSERT INTO issue_research (repo_id, issue_number, research)
     VALUES ($1, $2, $3)
     ON CONFLICT (repo_id, issue_number)
     DO UPDATE SET research = $3, created_at = NOW()
     RETURNING *`,
    [repoId, issueNumber, JSON.stringify(research)]
  );
  return result.rows[0];
}
