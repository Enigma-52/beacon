import { updateRepoStatus, updateRepoGithubData } from '../dao/repos';
import { insertReport } from '../dao/reports';
import { runAnalysisAgent } from '../agents/analysis.agent';
import { getRepoInfo } from '../tools/github.tools';
import { parseGitHubUrl } from '../utils/validation';
import { eventBus } from './event-bus';
import { cancellation } from './cancellation';
import { log } from './logger';

export async function processRepo(id: number, url: string): Promise<void> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('invalid GitHub URL');

  const { owner, repo } = parsed;
  if (cancellation.isRunning(id)) {
    log.warn({ repoId: id }, 'analysis already running — skipping duplicate');
    return;
  }
  const emit = eventBus.emitterFor(id);
  const signal = cancellation.register(id);

  log.info({ repoId: id, owner, repo }, 'processor started');

  try {
    await updateRepoStatus(id, 'fetching');

    // One free GitHub call so the feed has description/language/stars
    const repoInfo = await getRepoInfo(owner, repo).catch(() => null);
    await updateRepoGithubData(id, {
      owner,
      repo,
      fetched_at: new Date().toISOString(),
      description: repoInfo?.description ?? null,
      language: repoInfo?.language ?? null,
      stars: repoInfo?.stars ?? null,
      topics: repoInfo?.topics ?? [],
    });

    await updateRepoStatus(id, 'analyzing');
    const { analysis, meta } = await runAnalysisAgent(owner, repo, emit, signal);

    await insertReport(id, analysis, meta);
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
