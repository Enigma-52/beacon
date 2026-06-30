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
