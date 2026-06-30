export type RepoStatus = 'pending' | 'fetching' | 'analyzing' | 'done' | 'error';

export interface RepoReport {
  id: number;
  url: string;
  status: RepoStatus;
  github_data: unknown;
  analysis: {
    issues?: unknown;
    architecture?: unknown;
    health?: unknown;
    starting_points?: unknown;
  } | null;
  created_at: string;
}

// Must stay in sync with backend/src/agents/events.ts
export type AgentEvent =
  | { type: 'started'; owner: string; repo: string; model: string }
  | { type: 'iteration'; iteration: number; messageCount: number }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; success: boolean; summary: string }
  | { type: 'done'; iterations: number; totalTokens: number }
  | { type: 'error'; message: string };
