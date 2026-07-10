import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS repos (
      id          SERIAL PRIMARY KEY,
      url         TEXT UNIQUE NOT NULL,
      github_data JSONB,
      status      TEXT DEFAULT 'pending',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id          SERIAL PRIMARY KEY,
      repo_id     INT REFERENCES repos(id),
      analysis    JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS issue_research (
      id           SERIAL PRIMARY KEY,
      repo_id      INT REFERENCES repos(id),
      issue_number INT NOT NULL,
      research     JSONB NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (repo_id, issue_number)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id         SERIAL PRIMARY KEY,
      repo_id    INT REFERENCES repos(id),
      session_id TEXT NOT NULL,
      messages   JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (repo_id, session_id)
    );

    ALTER TABLE repos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE reports ADD COLUMN IF NOT EXISTS meta JSONB;

    CREATE INDEX IF NOT EXISTS idx_reports_repo_created ON reports (repo_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_issue_research_repo ON issue_research (repo_id);
    CREATE INDEX IF NOT EXISTS idx_repos_status ON repos (status);
  `);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
