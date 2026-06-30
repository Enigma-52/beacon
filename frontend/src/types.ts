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
