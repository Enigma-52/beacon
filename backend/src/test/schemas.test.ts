import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { GithubDataSchema, AnalysisSchema } from '../schemas';
import { IssueResearchSchema } from '../schemas/issue-research.schema';
import type { IssueResearch } from '../schemas/issue-research.schema';
import type { GithubData, Analysis } from '../schemas';

const ajv = new Ajv({ strict: false });
const validateGithub = ajv.compile(GithubDataSchema);
const validateAnalysis = ajv.compile(AnalysisSchema);
const validateResearch = ajv.compile(IssueResearchSchema);

const validGithubData: GithubData = {
  metadata: {
    name: 'react',
    description: 'A JavaScript library',
    stars: 200000,
    forks: 40000,
    language: 'JavaScript',
    license: 'MIT',
    open_issues: 700,
  },
  issues: [
    {
      number: 1,
      title: 'Fix render bug',
      labels: ['bug'],
      comments: 3,
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
  pull_requests: [
    {
      number: 10,
      title: 'Fix useEffect cleanup',
      merged_at: '2024-01-05T12:00:00Z',
      files_changed: 2,
      reviewer: 'gaearon',
      merge_time_hours: 48,
    },
  ],
  contributors: [{ login: 'gaearon', contributions: 2000 }],
  file_tree: ['src/index.js', 'src/react.js', 'packages/react'],
  readme: '# React\nA JavaScript library for building UIs.',
};

const validAnalysis: Analysis = {
  issues: [
    {
      number: 1,
      title: 'Fix render bug',
      github_url: 'https://github.com/facebook/react/issues/1',
      score: 7,
      reason: 'Well scoped, has good test coverage',
      difficulty: 'beginner',
      signals: { no_comments: false, no_related_prs: true, is_fresh: false },
    },
  ],
  architecture: {
    summary: 'React is a declarative UI library.',
    key_modules: ['src/react', 'packages/react-dom'],
    ownership: { 'src/react': ['https://github.com/gaearon'] },
  },
  health: {
    summary: 'Very active project with fast merges.',
    activity: 'high',
    pr_merge_speed: 'avg 2 days',
    contributor_concentration: 'low — well distributed',
    trend: 'stable',
  },
  starting_points: [
    {
      name: 'README.md',
      url: 'https://github.com/facebook/react/blob/main/README.md',
      reason: 'Start here for overview',
    },
    {
      name: 'Core exports',
      url: 'https://github.com/facebook/react/blob/main/packages/react/src/React.js',
      reason: 'Entry point for the library',
    },
  ],
};

describe('GithubDataSchema', () => {
  it('validates correct github data', () => {
    expect(validateGithub(validGithubData)).toBe(true);
  });

  it('rejects missing required fields', () => {
    const bad = { ...validGithubData, metadata: undefined };
    expect(validateGithub(bad)).toBe(false);
  });

  it('rejects wrong types', () => {
    const bad = { ...validGithubData, metadata: { ...validGithubData.metadata, stars: 'many' } };
    expect(validateGithub(bad)).toBe(false);
  });

  it('rejects extra top-level properties', () => {
    const bad = { ...validGithubData, extra_field: true };
    expect(validateGithub(bad)).toBe(false);
  });
});

describe('AnalysisSchema', () => {
  it('validates correct analysis', () => {
    expect(validateAnalysis(validAnalysis)).toBe(true);
  });

  it('rejects score out of range', () => {
    const bad: Analysis = {
      ...validAnalysis,
      issues: [{ ...validAnalysis.issues[0], score: 11 }],
    };
    expect(validateAnalysis(bad)).toBe(false);
  });

  it('rejects invalid difficulty enum', () => {
    const bad = {
      ...validAnalysis,
      issues: [{ ...validAnalysis.issues[0], difficulty: 'easy' }],
    };
    expect(validateAnalysis(bad)).toBe(false);
  });

  it('rejects invalid trend enum', () => {
    const bad = {
      ...validAnalysis,
      health: { ...validAnalysis.health, trend: 'booming' },
    };
    expect(validateAnalysis(bad)).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { architecture: _a, ...bad } = validAnalysis;
    expect(validateAnalysis(bad)).toBe(false);
  });

  it('rejects empty starting_points', () => {
    const bad = { ...validAnalysis, starting_points: [] };
    expect(validateAnalysis(bad)).toBe(false);
  });

  it('validates signals object', () => {
    const bad = {
      ...validAnalysis,
      issues: [{ ...validAnalysis.issues[0], signals: { no_comments: 'yes' } }],
    };
    expect(validateAnalysis(bad)).toBe(false);
  });

  it('requires github_url on issues', () => {
    const { github_url: _u, ...issueWithoutUrl } = validAnalysis.issues[0];
    const bad = { ...validAnalysis, issues: [issueWithoutUrl] };
    expect(validateAnalysis(bad)).toBe(false);
  });

  it('requires name and url on starting_points', () => {
    const bad = {
      ...validAnalysis,
      starting_points: [{ path: 'README.md', reason: 'start here' }],
    };
    expect(validateAnalysis(bad)).toBe(false);
  });
});

const validResearch: IssueResearch = {
  summary: 'This issue asks for adding support for X feature.',
  approach: '1. Find the config file\n2. Add the new option\n3. Write tests',
  files_to_change: [
    {
      path: 'src/config.go',
      reason: 'Add the new config option here',
      url: 'https://github.com/owner/repo/blob/main/src/config.go',
    },
  ],
  similar_prs: [
    {
      number: 42,
      title: 'Add support for Y feature',
      url: 'https://github.com/owner/repo/pull/42',
    },
  ],
  effort_estimate: 'days',
  reviewer_to_ping: 'https://github.com/somedev',
};

describe('IssueResearchSchema', () => {
  it('validates correct research output', () => {
    expect(validateResearch(validResearch)).toBe(true);
  });

  it('accepts hours effort estimate', () => {
    expect(validateResearch({ ...validResearch, effort_estimate: 'hours' })).toBe(true);
  });

  it('accepts week+ effort estimate', () => {
    expect(validateResearch({ ...validResearch, effort_estimate: 'week+' })).toBe(true);
  });

  it('rejects invalid effort_estimate', () => {
    expect(validateResearch({ ...validResearch, effort_estimate: 'months' })).toBe(false);
  });

  it('rejects missing summary', () => {
    const { summary: _s, ...bad } = validResearch;
    expect(validateResearch(bad)).toBe(false);
  });

  it('rejects missing approach', () => {
    const { approach: _a, ...bad } = validResearch;
    expect(validateResearch(bad)).toBe(false);
  });

  it('rejects files_to_change item missing url', () => {
    const bad = {
      ...validResearch,
      files_to_change: [{ path: 'src/config.go', reason: 'add option' }],
    };
    expect(validateResearch(bad)).toBe(false);
  });

  it('rejects similar_prs item missing number', () => {
    const bad = {
      ...validResearch,
      similar_prs: [{ title: 'Add Y', url: 'https://github.com/owner/repo/pull/42' }],
    };
    expect(validateResearch(bad)).toBe(false);
  });

  it('accepts empty files_to_change and similar_prs', () => {
    expect(validateResearch({ ...validResearch, files_to_change: [], similar_prs: [] })).toBe(true);
  });
});
