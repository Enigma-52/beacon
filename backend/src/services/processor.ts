import { updateRepoStatus, updateRepoGithubData } from '../dao/repos';
import { insertReport } from '../dao/reports';
import { fetchGitHubData } from './github';
import { analyzeWithOpenRouter } from './openrouter';
import { log } from './logger';

export async function processRepo(id: number, url: string): Promise<void> {
  log.info({ repoId: id, url }, 'processor started');

  try {
    log.info({ repoId: id }, 'step 1/3 — fetching GitHub data');
    await updateRepoStatus(id, 'fetching');
    const githubData = await fetchGitHubData(url);
    await updateRepoGithubData(id, githubData);

    log.info({ repoId: id }, 'step 2/3 — running AI analysis');
    await updateRepoStatus(id, 'analyzing');
    const analysis = await analyzeWithOpenRouter(githubData);
    await insertReport(id, analysis);

    log.info({ repoId: id }, 'step 3/3 — done');
    await updateRepoStatus(id, 'done');
  } catch (err) {
    log.error({ repoId: id, err }, 'processor failed');
    await updateRepoStatus(id, 'error').catch(() => {});
  }
}
