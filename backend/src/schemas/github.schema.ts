export interface RepoMetadata {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  license: string | null;
  open_issues: number;
}

export interface GithubIssue {
  number: number;
  title: string;
  labels: string[];
  comments: number;
  created_at: string;
}

export interface GithubPR {
  number: number;
  title: string;
  merged_at: string | null;
  files_changed: number;
  reviewer: string | null;
  merge_time_hours: number | null;
}

export interface Contributor {
  login: string;
  contributions: number;
}

export interface GithubData {
  metadata: RepoMetadata;
  issues: GithubIssue[];
  pull_requests: GithubPR[];
  contributors: Contributor[];
  file_tree: string[];
  readme: string;
}

// JSON Schema (draft-07, ajv compatible)
export const GithubDataSchema = {
  type: 'object',
  required: ['metadata', 'issues', 'pull_requests', 'contributors', 'file_tree', 'readme'],
  additionalProperties: false,
  properties: {
    metadata: {
      type: 'object',
      required: ['name', 'description', 'stars', 'forks', 'language', 'license', 'open_issues'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
        stars: { type: 'number' },
        forks: { type: 'number' },
        language: { type: ['string', 'null'] },
        license: { type: ['string', 'null'] },
        open_issues: { type: 'number' },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'title', 'labels', 'comments', 'created_at'],
        additionalProperties: false,
        properties: {
          number: { type: 'number' },
          title: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          comments: { type: 'number' },
          created_at: { type: 'string' },
        },
      },
    },
    pull_requests: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'title', 'merged_at', 'files_changed', 'reviewer', 'merge_time_hours'],
        additionalProperties: false,
        properties: {
          number: { type: 'number' },
          title: { type: 'string' },
          merged_at: { type: ['string', 'null'] },
          files_changed: { type: 'number' },
          reviewer: { type: ['string', 'null'] },
          merge_time_hours: { type: ['number', 'null'] },
        },
      },
    },
    contributors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['login', 'contributions'],
        additionalProperties: false,
        properties: {
          login: { type: 'string' },
          contributions: { type: 'number' },
        },
      },
    },
    file_tree: { type: 'array', items: { type: 'string' } },
    readme: { type: 'string' },
  },
} as const;
