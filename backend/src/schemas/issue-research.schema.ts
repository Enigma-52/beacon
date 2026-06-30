export interface FileToChange {
  path: string;
  reason: string;
  url: string;
}

export interface SimilarPr {
  number: number;
  title: string;
  url: string;
}

export interface IssueResearch {
  summary: string;
  approach: string;
  files_to_change: FileToChange[];
  similar_prs: SimilarPr[];
  effort_estimate: 'hours' | 'days' | 'week+';
  reviewer_to_ping: string;
}

export const IssueResearchSchema = {
  type: 'object',
  required: ['summary', 'approach', 'files_to_change', 'similar_prs', 'effort_estimate', 'reviewer_to_ping'],
  properties: {
    summary: { type: 'string' },
    approach: { type: 'string' },
    files_to_change: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'reason', 'url'],
        properties: {
          path: { type: 'string' },
          reason: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    similar_prs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'title', 'url'],
        properties: {
          number: { type: 'number' },
          title: { type: 'string' },
          url: { type: 'string' },
        },
      },
    },
    effort_estimate: { type: 'string', enum: ['hours', 'days', 'week+'] },
    reviewer_to_ping: { type: 'string' },
  },
} as const;
