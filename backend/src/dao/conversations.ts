import { pool } from '../services/db';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function getConversation(repoId: number, sessionId: string): Promise<ChatTurn[]> {
  const result = await pool.query<{ messages: ChatTurn[] }>(
    'SELECT messages FROM conversations WHERE repo_id = $1 AND session_id = $2',
    [repoId, sessionId]
  );
  return result.rows[0]?.messages ?? [];
}

export async function appendTurns(repoId: number, sessionId: string, turns: ChatTurn[]): Promise<void> {
  await pool.query(
    `INSERT INTO conversations (repo_id, session_id, messages)
     VALUES ($1, $2, $3)
     ON CONFLICT (repo_id, session_id)
     DO UPDATE SET messages = conversations.messages || EXCLUDED.messages, updated_at = NOW()`,
    [repoId, sessionId, JSON.stringify(turns)]
  );
}
