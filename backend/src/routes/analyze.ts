import { Router, Request, Response } from 'express';
import { upsertRepo, findRepoById, findRepoByUrl } from '../dao/repos';
import { findReportByRepoId, listReportsByRepo } from '../dao/reports';
import { asyncRoute } from '../middleware/errors';
import { isValidGitHubUrl } from '../utils/validation';
import { processRepo } from '../services/processor';
import { cancellation } from '../services/cancellation';

export const analyzeRouter = Router();

analyzeRouter.post('/analyze', async (req: Request, res: Response) => {
  const { url, force } = req.body as { url?: string; force?: boolean };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  if (!isValidGitHubUrl(url)) {
    res.status(400).json({ error: 'invalid GitHub URL' });
    return;
  }

  try {
    // Return cached analysis if done within last 24h
    const existing = await findRepoByUrl(url);
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    if (
      !force &&
      existing &&
      existing.status === 'done' &&
      Date.now() - new Date(existing.updated_at).getTime() < CACHE_TTL_MS
    ) {
      res.json({ id: existing.id, status: 'done', cached: true });
      return;
    }

    // Join an analysis already in flight for this URL instead of racing it
    if (existing && cancellation.isRunning(existing.id)) {
      res.json({ id: existing.id, status: existing.status, in_flight: true });
      return;
    }

    const repo = await upsertRepo(url);
    res.json({ id: repo.id, status: repo.status });

    processRepo(repo.id, url).catch((err) =>
      console.error('[analyze] unhandled processRepo error:', err)
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

analyzeRouter.post('/cancel/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  const cancelled = cancellation.cancel(id);
  res.json({ cancelled });
});

/** Analysis history — when it was re-analyzed and what each run cost. */
analyzeRouter.get(
  '/repos/:id/reports',
  asyncRoute(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'invalid id' }); return; }
    const reports = await listReportsByRepo(id);
    res.json({ reports });
  })
);

analyzeRouter.get('/report/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }

  try {
    const repo = await findRepoById(id);

    if (!repo) {
      res.status(404).json({ error: 'report not found' });
      return;
    }

    const report = await findReportByRepoId(id);
    res.json({ ...repo, analysis: report?.analysis ?? null, meta: report?.meta ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});
