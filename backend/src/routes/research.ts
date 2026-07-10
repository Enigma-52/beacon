import { Router, Request, Response } from 'express';
import { findRepoById } from '../dao/repos';
import { findIssueResearch, upsertIssueResearch, listResearchedIssues } from '../dao/issue-research';
import { asyncRoute } from '../middleware/errors';
import { runIssueResearcherAgent } from '../agents/issue-researcher.agent';
import { eventBus } from '../services/event-bus';
import { log } from '../services/logger';

export const researchRouter = Router();

/** Maps "repoId:issueNumber" → AbortController for cancellation. */
const activeResearch = new Map<string, AbortController>();

/** List issues that already have research for this repo (badge data). */
researchRouter.get(
  '/research/:repoId',
  asyncRoute(async (req: Request, res: Response) => {
    const repoId = parseInt(req.params.repoId, 10);
    if (isNaN(repoId)) { res.status(400).json({ error: 'invalid repo id' }); return; }
    const researched = await listResearchedIssues(repoId);
    res.json({ researched });
  })
);

researchRouter.get('/research/:repoId/:issueNumber', async (req: Request, res: Response) => {
  const repoId = parseInt(req.params.repoId, 10);
  const issueNumber = parseInt(req.params.issueNumber, 10);
  if (isNaN(repoId) || isNaN(issueNumber)) { res.status(400).json({ error: 'invalid params' }); return; }

  const key = `${repoId}:${issueNumber}`;
  try {
    const cached = await findIssueResearch(repoId, issueNumber);
    if (cached) { res.json({ research: cached.research, cached: true, created_at: cached.created_at }); return; }
    if (activeResearch.has(key)) { res.json({ status: 'running' }); return; }
    res.status(404).json({ error: 'not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

researchRouter.post('/research/:repoId/:issueNumber', async (req: Request, res: Response) => {
  const repoId = parseInt(req.params.repoId, 10);
  const issueNumber = parseInt(req.params.issueNumber, 10);
  if (isNaN(repoId) || isNaN(issueNumber)) { res.status(400).json({ error: 'invalid params' }); return; }

  const key = `${repoId}:${issueNumber}`;

  try {
    const cached = await findIssueResearch(repoId, issueNumber);
    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) { res.json({ research: cached.research, cached: true }); return; }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
    return;
  }

  if (activeResearch.has(key)) { res.json({ status: 'running' }); return; }

  const repo = await findRepoById(repoId).catch(() => null);
  if (!repo) { res.status(404).json({ error: 'repo not found' }); return; }

  const match = repo.url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) { res.status(400).json({ error: 'cannot parse repo URL' }); return; }
  const [, owner, repoName] = match;

  const controller = new AbortController();
  activeResearch.set(key, controller);
  res.json({ status: 'running' });

  const emit = eventBus.emitterFor(repoId);

  runIssueResearcherAgent(owner, repoName, issueNumber, emit, controller.signal)
    .then(async (research) => {
      await upsertIssueResearch(repoId, issueNumber, research);
      // Emit done AFTER DB save so the client can immediately fetch the result
      emit({ type: 'research_done' });
      log.info({ repoId, issueNumber }, 'issue research saved');
    })
    .catch((err: Error) => {
      if (err.message !== 'Issue research cancelled') {
        log.error({ err, repoId, issueNumber }, 'issue research failed');
        emit({ type: 'research_error', message: err.message });
      }
    })
    .finally(() => {
      activeResearch.delete(key);
    });
});

researchRouter.post('/research/:repoId/:issueNumber/cancel', (req: Request, res: Response) => {
  const repoId = parseInt(req.params.repoId, 10);
  const issueNumber = parseInt(req.params.issueNumber, 10);
  if (isNaN(repoId) || isNaN(issueNumber)) { res.status(400).json({ error: 'invalid params' }); return; }

  const key = `${repoId}:${issueNumber}`;
  const controller = activeResearch.get(key);
  if (controller) {
    controller.abort();
    activeResearch.delete(key);
    res.json({ cancelled: true });
  } else {
    res.json({ cancelled: false });
  }
});
