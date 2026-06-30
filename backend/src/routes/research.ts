import { Router, Request, Response } from 'express';
import { findRepoById } from '../dao/repos';
import { findIssueResearch, upsertIssueResearch } from '../dao/issue-research';
import { runIssueResearcherAgent } from '../agents/issue-researcher.agent';
import { log } from '../services/logger';

export const researchRouter = Router();

researchRouter.get('/research/:repoId/:issueNumber', async (req: Request, res: Response) => {
  const repoId = parseInt(req.params.repoId, 10);
  const issueNumber = parseInt(req.params.issueNumber, 10);

  if (isNaN(repoId) || isNaN(issueNumber)) {
    res.status(400).json({ error: 'invalid params' });
    return;
  }

  try {
    const cached = await findIssueResearch(repoId, issueNumber);
    if (cached) {
      res.json({ research: cached.research, cached: true, created_at: cached.created_at });
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

  try {
    // Return cached if fresh (< 7 days)
    const cached = await findIssueResearch(repoId, issueNumber);
    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) {
        res.json({ research: cached.research, cached: true });
        return;
      }
    }

    const repo = await findRepoById(repoId);
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

    log.info({ repoId, issueNumber, owner, repo: repoName }, 'starting issue research');

    const research = await runIssueResearcherAgent(owner, repoName, issueNumber);
    await upsertIssueResearch(repoId, issueNumber, research);

    res.json({ research, cached: false });
  } catch (err) {
    log.error({ err }, 'issue research failed');
    res.status(500).json({ error: err instanceof Error ? err.message : 'internal server error' });
  }
});
