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
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id          SERIAL PRIMARY KEY,
      repo_id     INT REFERENCES repos(id),
      analysis    JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
