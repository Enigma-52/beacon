import { Router, Request, Response } from 'express';
import { findAllDoneRepos } from '../dao/repos';
import type { RankedIssue } from '../schemas';

export const feedRouter = Router();

feedRouter.get('/feed', async (_req: Request, res: Response) => {
  try {
    const repos = await findAllDoneRepos();

    const rows = repos.map((r) => {
      const gd = r.github_data as Record<string, unknown> | null;
      const analysis = r.analysis as { issues?: RankedIssue[] } | null;
      const issues = (analysis?.issues ?? [])
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        id: r.id,
        url: r.url,
        name: r.url.replace('https://github.com/', ''),
        description: (gd?.description as string | null) ?? null,
        language: (gd?.language as string | null) ?? null,
        stars: (gd?.stars as number | null) ?? null,
        last_analyzed: r.updated_at,
        top_issues: issues,
      };
    });

    // Extract unique languages for sidebar filter
    const languages = [...new Set(rows.map((r) => r.language).filter(Boolean))].sort() as string[];

    res.json({ repos: rows, languages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal server error' });
  }
});
