import { Router, Request, Response } from 'express';
import { findRepoById } from '../dao/repos';
import { findIssueResearch, upsertIssueResearch } from '../dao/issue-research';
import { runIssueResearcherAgent } from '../agents/issue-researcher.agent';
import { eventBus } from '../services/event-bus';
import { log } from '../services/logger';

export const researchRouter = Router();

/** Track which (repoId, issueNumber) pairs are currently being researched. */
const activeResearch = new Set<string>();

researchRouter.get('/research/:repoId/:issueNumber', async (req: Request, res: Response) => {
  const repoId = parseInt(req.params.repoId, 10);
  const issueNumber = parseInt(req.params.issueNumber, 10);

  if (isNaN(repoId) || isNaN(issueNumber)) {
    res.status(400).json({ error: 'invalid params' });
    return;
  }

  const key = `${repoId}:${issueNumber}`;

  try {
    const cached = await findIssueResearch(repoId, issueNumber);
    if (cached) {
      res.json({ research: cached.research, cached: true, created_at: cached.created_at });
      return;
    }
    if (activeResearch.has(key)) {
      res.json({ status: 'running' });
      return;
    }
    res.status(404).json({ error: 'not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});

researchRouter.post('/research/:repoId/:issueNumber', async (req: Request, res: Response) => {
  const repoId = parseInt(req.params.repoId, 10);
  const issueNumber = parseInt(req.params.issueNumber, 10);

  if (isNaN(repoId) || isNaN(issueNumber)) {
    res.status(400).json({ error: 'invalid params' });
    return;
  }

  const key = `${repoId}:${issueNumber}`;

  // Return cached if fresh (< 7 days)
  try {
    const cached = await findIssueResearch(repoId, issueNumber);
    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) {
        res.json({ research: cached.research, cached: true });
        return;
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
    return;
  }

  if (activeResearch.has(key)) {
    res.json({ status: 'running' });
    return;
  }

  const repo = await findRepoById(repoId).catch(() => null);
  if (!repo) {
    res.status(404).json({ error: 'repo not found' });
    return;
  }

  const match = repo.url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    res.status(400).json({ error: 'cannot parse repo URL' });
    return;
  }
  const [, owner, repoName] = match;

  // Fire-and-forget — stream progress over WS
  activeResearch.add(key);
  res.json({ status: 'running' });

  const emit = eventBus.emitterFor(repoId);

  runIssueResearcherAgent(owner, repoName, issueNumber, emit)
    .then(async (research) => {
      await upsertIssueResearch(repoId, issueNumber, research);
      log.info({ repoId, issueNumber }, 'issue research saved');
    })
    .catch((err) => {
      log.error({ err, repoId, issueNumber }, 'issue research failed');
    })
    .finally(() => {
      activeResearch.delete(key);
    });
});
