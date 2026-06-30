/**
 * OpenAI-format tool definitions sent to the LLM.
 * Executors live in github.tools.ts.
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
      description:
        'List open issues. Returns number, title, body snippet, labels, comment count, age. Note which issues have 0 comments (fresh/untouched) or no related PRs (never attempted).',
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
      description:
        'List recently merged PRs. Returns title, author, reviewers, merge time. Use to understand contribution patterns and identify who reviews what.',
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
      description:
        'Get full details for a single PR: files changed, review comments, body. Use selectively — at most 2–3 PRs per analysis. Best for understanding review style or file ownership.',
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
      description: 'List top contributors with commit counts. Use to build the ownership map.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_file_tree',
      description: 'Get the repo directory structure (top 3 levels). Use to understand project layout and find key files.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_file_content',
      description:
        'Read a specific file (first 6000 chars). Best for: CONTRIBUTING.md, README, package.json, key source files referenced in many PRs.',
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
      description: 'Get the repository README content. Use when you need project context not visible from metadata.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'produce_analysis',
      description:
        'Submit your final structured analysis. Call this when you have enough information. This ends the analysis session.',
      parameters: {
        type: 'object',
        required: ['issues', 'architecture', 'health', 'starting_points'],
        additionalProperties: false,
        properties: {
          issues: {
            type: 'array',
            description: 'Open issues ranked by approachability (up to 10). Higher score = easier to pick up.',
            items: {
              type: 'object',
              required: ['number', 'title', 'github_url', 'score', 'reason', 'difficulty', 'signals'],
              properties: {
                number: { type: 'number' },
                title: { type: 'string' },
                github_url: {
                  type: 'string',
                  description: 'https://github.com/{owner}/{repo}/issues/{number}',
                },
                score: { type: 'number', description: '1 (hardest) to 10 (easiest to pick up first)' },
                reason: { type: 'string', description: 'One sentence explaining the score' },
                difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                signals: {
                  type: 'object',
                  required: ['no_comments', 'no_related_prs', 'is_fresh'],
                  description: 'Factual signals about the issue state',
                  properties: {
                    no_comments: { type: 'boolean', description: 'True if the issue has 0 comments' },
                    no_related_prs: { type: 'boolean', description: 'True if no merged PR references this issue number' },
                    is_fresh: { type: 'boolean', description: 'True if opened within the last 30 days' },
                  },
                },
              },
            },
          },
          architecture: {
            type: 'object',
            required: ['summary', 'key_modules', 'ownership'],
            properties: {
              summary: {
                type: 'string',
                description: 'Plain English: what the codebase does, how it is structured, key abstractions',
              },
              key_modules: {
                type: 'array',
                items: { type: 'string' },
                description: 'Key files or directories (e.g. "lib/index.js", "src/core")',
              },
              ownership: {
                type: 'object',
                description: 'Map of module/file → array of GitHub profile URLs for contributors who own it',
                additionalProperties: {
                  type: 'array',
                  items: { type: 'string', description: 'https://github.com/{login}' },
                },
              },
            },
          },
          health: {
            type: 'object',
            required: ['summary', 'activity', 'pr_merge_speed', 'contributor_concentration', 'trend'],
            properties: {
              summary: { type: 'string', description: 'One paragraph health assessment' },
              activity: { type: 'string', description: '"high", "medium", or "low" with brief justification' },
              pr_merge_speed: { type: 'string', description: 'e.g. "avg 2 days", "same day for small fixes"' },
              contributor_concentration: {
                type: 'string',
                description: 'e.g. "high — 2 people do 80% of commits", "well distributed across 8 contributors"',
              },
              trend: { type: 'string', enum: ['growing', 'stable', 'declining', 'unknown'] },
            },
          },
          starting_points: {
            type: 'array',
            description: '3–5 files or docs a new contributor should read first, ordered by importance',
            minItems: 1,
            maxItems: 5,
            items: {
              type: 'object',
              required: ['name', 'url', 'reason'],
              properties: {
                name: { type: 'string', description: 'Display name, e.g. "README.md" or "Core middleware"' },
                url: {
                  type: 'string',
                  description: 'Full GitHub URL: https://github.com/{owner}/{repo}/blob/main/{path}',
                },
                reason: { type: 'string', description: 'Why this file matters for a new contributor' },
              },
            },
          },
        },
      },
    },
  },
] as const;

export const ALL_TOOLS = GITHUB_TOOL_DEFINITIONS;
