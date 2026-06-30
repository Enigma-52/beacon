import {
  getRepoInfo,
  listIssues,
  listMergedPrs,
  getPrDetails,
  listContributors,
  getFileTree,
  getFileContent,
  getReadme,
} from './github.tools';
import { log } from '../services/logger';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
  /** Human-readable summary for the event stream */
  summary: string;
}

export interface AnalysisDone {
  done: true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

function summarize(name: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  switch (name) {
    case 'get_repo_info':
      return `${r.name} — ${r.stars} stars, ${r.language ?? 'unknown lang'}`;
    case 'list_issues':
      return `${(result as unknown[]).length} open issues`;
    case 'list_merged_prs':
      return `${(result as unknown[]).length} merged PRs`;
    case 'get_pr_details':
      return `PR #${(r.number as number)} — ${(r.files_changed as unknown[]).length} files`;
    case 'list_contributors':
      return `${(result as unknown[]).length} contributors`;
    case 'get_file_tree':
      return `${(result as unknown[]).length} paths`;
    case 'get_file_content':
      return `${r.path} (${((r.content as string)?.length ?? 0).toLocaleString()} chars)`;
    case 'get_readme':
      return `readme (${((r.content as string)?.length ?? 0).toLocaleString()} chars)`;
    default:
      return 'ok';
  }
}

export async function executeTool(
  call: ToolCall,
  owner: string,
  repo: string
): Promise<ToolResult | AnalysisDone> {
  const args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
  const name = call.function.name;

  log.info({ tool: name, args }, 'executing tool');

  if (name === 'produce_analysis') {
    return { done: true, payload: args };
  }

  let result: unknown;
  let success = true;

  try {
    switch (name) {
      case 'get_repo_info':
        result = await getRepoInfo(owner, repo);
        break;
      case 'list_issues':
        result = await listIssues(owner, repo, (args.limit as number | undefined) ?? 30);
        break;
      case 'list_merged_prs':
        result = await listMergedPrs(owner, repo, (args.limit as number | undefined) ?? 20);
        break;
      case 'get_pr_details':
        result = await getPrDetails(owner, repo, args.pr_number as number);
        break;
      case 'list_contributors':
        result = await listContributors(owner, repo);
        break;
      case 'get_file_tree':
        result = await getFileTree(owner, repo);
        break;
      case 'get_file_content':
        result = await getFileContent(owner, repo, args.path as string);
        break;
      case 'get_readme':
        result = await getReadme(owner, repo);
        break;
      default:
        result = { error: `unknown tool: ${name}` };
        success = false;
    }
  } catch (err) {
    log.warn({ tool: name, err }, 'tool execution failed');
    result = { error: err instanceof Error ? err.message : String(err) };
    success = false;
  }

  return {
    tool_call_id: call.id,
    role: 'tool',
    content: JSON.stringify(result),
    summary: success ? summarize(name, result) : `error: ${(result as Record<string, string>).error}`,
  };
}
