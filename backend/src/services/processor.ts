import { updateRepoStatus, updateRepoGithubData } from '../dao/repos';
import { insertReport } from '../dao/reports';
import { runAnalysisAgent } from '../agents/analysis.agent';
import { parseGitHubUrl } from '../utils/validation';
import { eventBus } from './event-bus';
import { cancellation } from './cancellation';
import { log } from './logger';

export async function processRepo(id: number, url: string): Promise<void> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('invalid GitHub URL');

  const { owner, repo } = parsed;
  const emit = eventBus.emitterFor(id);
  const signal = cancellation.register(id);

  log.info({ repoId: id, owner, repo }, 'processor started');

  try {
    await updateRepoStatus(id, 'fetching');
    await updateRepoGithubData(id, { owner, repo, fetched_at: new Date().toISOString() });

    await updateRepoStatus(id, 'analyzing');
    const analysis = await runAnalysisAgent(owner, repo, emit, signal);

    await insertReport(id, analysis);
    await updateRepoStatus(id, 'done');

    log.info({ repoId: id }, 'processor complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isCancelled = message === 'Analysis cancelled';

    log.error({ repoId: id, err }, isCancelled ? 'processor cancelled' : 'processor failed');
    emit({ type: 'error', message });
    await updateRepoStatus(id, 'error').catch(() => {});
  } finally {
    cancellation.cleanup(id);
  }
}
