import { updateRepoStatus, updateRepoGithubData } from '../dao/repos';
import { insertReport } from '../dao/reports';
import { runAnalysisAgent } from '../agents/analysis.agent';
import { parseGitHubUrl } from '../utils/validation';
import { log } from './logger';

export async function processRepo(id: number, url: string): Promise<void> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('invalid GitHub URL');

  const { owner, repo } = parsed;
  log.info({ repoId: id, owner, repo }, 'processor started');

  try {
    // Mark as fetching — the agent will call GitHub tools during analysis
    await updateRepoStatus(id, 'fetching');

    // Store a placeholder so GET /report/:id returns something while in progress
    await updateRepoGithubData(id, { owner, repo, fetched_at: new Date().toISOString() });

    log.info({ repoId: id }, 'starting analysis agent');
    await updateRepoStatus(id, 'analyzing');

    const analysis = await runAnalysisAgent(owner, repo);

    await insertReport(id, analysis);
    await updateRepoStatus(id, 'done');

    log.info({ repoId: id }, 'processor complete');
  } catch (err) {
    log.error({ repoId: id, err }, 'processor failed');
    await updateRepoStatus(id, 'error').catch(() => {});
  }
}
