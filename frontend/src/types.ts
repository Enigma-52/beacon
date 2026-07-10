import type { RankedIssue } from './analysisTypes';

export type RepoStatus = 'pending' | 'fetching' | 'analyzing' | 'done' | 'error';

export interface ReportMeta {
  model?: string;
  iterations?: number;
  total_tokens?: number;
  duration_ms?: number;
}

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
  meta?: ReportMeta | null;
  created_at: string;
}

export interface FeedRepo {
  id: number;
  url: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number | null;
  last_analyzed: string;
  top_issues: RankedIssue[];
}

export interface FeedResponse {
  repos: FeedRepo[];
  languages: string[];
}

export interface IssueResearch {
  summary: string;
  approach: string;
  files_to_change: { path: string; reason: string; url: string }[];
  similar_prs: { number: number; title: string; url: string }[];
  effort_estimate: 'hours' | 'days' | 'week+';
  reviewer_to_ping: string;
}

export interface IssueResearchResponse {
  research: IssueResearch;
  cached: boolean;
  created_at?: string;
}

export interface MatchedIssue {
  repo_url: string;
  repo_id: number;
  issue: RankedIssue;
  fit_score: number;
  fit_reason: string;
}

export interface MatchResponse {
  matches: MatchedIssue[];
}

// Must stay in sync with backend/src/agents/events.ts
export type AgentEvent =
  | { type: 'started'; owner: string; repo: string; model: string }
  | { type: 'iteration'; iteration: number; messageCount: number }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; success: boolean; summary: string }
  | { type: 'done'; iterations: number; totalTokens: number }
  | { type: 'error'; message: string }
  | { type: 'research_started'; owner: string; repo: string; issueNumber: number }
  | { type: 'research_done' }
  | { type: 'research_error'; message: string };
