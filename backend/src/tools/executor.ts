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
}

// Sentinel returned when produce_analysis is called
export interface AnalysisDone {
  done: true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
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
    }
  } catch (err) {
    log.warn({ tool: name, err }, 'tool execution failed');
    result = { error: err instanceof Error ? err.message : String(err) };
  }

  return {
    tool_call_id: call.id,
    role: 'tool',
    content: JSON.stringify(result),
  };
}
