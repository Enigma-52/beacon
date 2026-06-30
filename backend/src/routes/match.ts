import { Router, Request, Response } from 'express';
import { findAllDoneRepos } from '../dao/repos';
import { runContributorMatcher } from '../agents/contributor-matcher';
import type { ContributorProfile } from '../agents/contributor-matcher';
import type { RankedIssue } from '../schemas';

export const matchRouter = Router();

matchRouter.post('/match', async (req: Request, res: Response) => {
  const { skills, level, interests } = req.body as Partial<ContributorProfile>;

  if (!skills?.length || !level) {
    res.status(400).json({ error: 'skills (array) and level are required' });
    return;
  }

  if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
    res.status(400).json({ error: 'level must be beginner, intermediate, or advanced' });
    return;
  }

  try {
    const repos = await findAllDoneRepos();
    const repoData = repos.map((r) => ({
      id: r.id,
      url: r.url,
      issues: ((r.analysis as { issues?: RankedIssue[] } | null)?.issues ?? []),
    }));

    const matches = await runContributorMatcher({ skills, level, interests }, repoData);
    res.json({ matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'internal server error' });
  }
});
