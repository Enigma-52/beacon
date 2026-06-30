/**
 * OpenAI-format tool definitions sent to the LLM.
 * Executors live in github.tools.ts and analysis.tools.ts.
 */

export const GITHUB_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_repo_info',
      description: 'Get repository metadata: name, description, stars, forks, language, license, activity dates.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_issues',
      description: 'List open issues. Returns number, title, body snippet, labels, comment count, age.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max issues to return (default 30, max 50)', default: 30 },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_merged_prs',
      description: 'List recently merged PRs. Returns title, author, reviewers, files changed count, merge time.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max PRs to return (default 20, max 50)', default: 20 },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pr_details',
      description: 'Get full details for a single PR: files changed, review feedback, body. Use this selectively.',
      parameters: {
        type: 'object',
        properties: {
          pr_number: { type: 'number', description: 'PR number' },
        },
        required: ['pr_number'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_contributors',
      description: 'List top contributors with commit counts.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_file_tree',
      description: 'Get the repo directory structure (top 3 levels). Useful for understanding project layout.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_file_content',
      description: 'Read a specific file (first 6000 chars). Best for: CONTRIBUTING.md, README, key source files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to repo root, e.g. "CONTRIBUTING.md"' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_readme',
      description: 'Get the repository README content.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'produce_analysis',
      description: 'Submit your final structured analysis. Call this when you have enough information. This ends the analysis.',
      parameters: {
        type: 'object',
        required: ['issues', 'architecture', 'health', 'starting_points'],
        additionalProperties: false,
        properties: {
          issues: {
            type: 'array',
            description: 'Ranked open issues by approachability (up to 10)',
            items: {
              type: 'object',
              required: ['number', 'title', 'score', 'reason', 'difficulty'],
              properties: {
                number: { type: 'number' },
                title: { type: 'string' },
                score: { type: 'number', description: '1 (hardest) to 10 (easiest)' },
                reason: { type: 'string', description: 'One sentence why this score' },
                difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
              },
            },
          },
          architecture: {
            type: 'object',
            required: ['summary', 'key_modules', 'ownership'],
            properties: {
              summary: { type: 'string', description: 'Plain English description of what this codebase does and how' },
              key_modules: { type: 'array', items: { type: 'string' }, description: 'Key directories or modules' },
              ownership: {
                type: 'object',
                description: 'Map of module/dir → contributor logins who own it',
                additionalProperties: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          health: {
            type: 'object',
            required: ['summary', 'activity', 'pr_merge_speed', 'contributor_concentration', 'trend'],
            properties: {
              summary: { type: 'string' },
              activity: { type: 'string', description: 'high / medium / low' },
              pr_merge_speed: { type: 'string', description: 'e.g. "avg 2 days"' },
              contributor_concentration: { type: 'string', description: 'e.g. "high — 2 contributors do 80% of commits"' },
              trend: { type: 'string', enum: ['growing', 'stable', 'declining', 'unknown'] },
            },
          },
          starting_points: {
            type: 'array',
            description: '3–5 files or docs a new contributor should read first',
            minItems: 1,
            maxItems: 5,
            items: {
              type: 'object',
              required: ['path', 'reason'],
              properties: {
                path: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
] as const;

export const ALL_TOOLS = GITHUB_TOOL_DEFINITIONS;
