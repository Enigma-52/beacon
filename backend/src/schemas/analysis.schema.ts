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
    is_fresh: boolean; // opened within last 30 days
  };
}

export interface Architecture {
  summary: string;
  key_modules: string[];
  /** module/dir path → array of GitHub profile URLs (https://github.com/{login}) */
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

// JSON Schema (draft-07, ajv compatible)
export const AnalysisSchema = {
  type: 'object',
  required: ['issues', 'architecture', 'health', 'starting_points'],
  additionalProperties: false,
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'title', 'github_url', 'score', 'reason', 'difficulty', 'signals'],
        additionalProperties: false,
        properties: {
          number: { type: 'number' },
          title: { type: 'string' },
          github_url: { type: 'string' },
          score: { type: 'number', minimum: 1, maximum: 10 },
          reason: { type: 'string' },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          signals: {
            type: 'object',
            required: ['no_comments', 'no_related_prs', 'is_fresh'],
            additionalProperties: false,
            properties: {
              no_comments: { type: 'boolean' },
              no_related_prs: { type: 'boolean' },
              is_fresh: { type: 'boolean' },
            },
          },
        },
      },
    },
    architecture: {
      type: 'object',
      required: ['summary', 'key_modules', 'ownership'],
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        key_modules: { type: 'array', items: { type: 'string' } },
        ownership: {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    health: {
      type: 'object',
      required: ['summary', 'activity', 'pr_merge_speed', 'contributor_concentration', 'trend'],
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        activity: { type: 'string' },
        pr_merge_speed: { type: 'string' },
        contributor_concentration: { type: 'string' },
        trend: { type: 'string', enum: ['growing', 'stable', 'declining', 'unknown'] },
      },
    },
    starting_points: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        required: ['name', 'url', 'reason'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;
