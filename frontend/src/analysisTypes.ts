/** Must stay in sync with backend/src/schemas/analysis.schema.ts */

export interface RankedIssue {
  number: number;
  title: string;
  github_url: string;
  score: number;
  reason: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  signals: {
    no_comments: boolean;
    no_related_prs: boolean;
    is_fresh: boolean;
  };
}

export interface Architecture {
  summary: string;
  key_modules: string[];
  ownership: Record<string, string[]>;
}

export interface Health {
  summary: string;
  activity: string;
  pr_merge_speed: string;
  contributor_concentration: string;
  trend: 'growing' | 'stable' | 'declining' | 'unknown';
}

export interface StartingPoint {
  name: string;
  url: string;
  reason: string;
}

export interface Analysis {
  issues: RankedIssue[];
  architecture: Architecture;
  health: Health;
  starting_points: StartingPoint[];
}
