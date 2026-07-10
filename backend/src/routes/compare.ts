import { Router, Request, Response } from 'express';
import { findRepoById } from '../dao/repos';
import { findReportByRepoId } from '../dao/reports';
import { complete } from '../services/openrouter';
import { asyncRoute } from '../middleware/errors';
import { log } from '../services/logger';

export const compareRouter = Router();

interface CompareVerdict {
  winner_repo_id: number;
  reasoning: string;
  per_repo: { repo_id: number; verdict: string; best_for: string }[];
}

/**
 * Compare 2–3 analyzed repos for contribution-worthiness.
 * One cheap completion over stored analyses — no GitHub calls.
 */
compareRouter.post(
  '/compare',
  asyncRoute(async (req: Request, res: Response) => {
    const { repo_ids } = req.body as { repo_ids?: unknown };

    if (
      !Array.isArray(repo_ids) ||
      repo_ids.length < 2 ||
      repo_ids.length > 3 ||
      !repo_ids.every((id) => Number.isInteger(id))
    ) {
      res.status(400).json({ error: 'repo_ids (2–3 integers) is required' });
      return;
    }

    const ids = repo_ids as number[];
    const repos = await Promise.all(
      ids.map(async (id) => {
        const repo = await findRepoById(id);
        const report = repo ? await findReportByRepoId(id) : null;
        return repo && report?.analysis ? { id, url: repo.url, analysis: report.analysis } : null;
      })
    );

    const missing = ids.filter((_, i) => !repos[i]);
    if (missing.length) {
      res.status(404).json({ error: `no analysis for repo ids: ${missing.join(', ')}` });
      return;
    }

    const prompt = `You are comparing GitHub repositories for a contributor deciding where to invest their time. Each repo has a stored Beacon analysis (ranked issues, architecture, health).

Repos:
${repos.map((r) => `--- repo_id ${r!.id}: ${r!.url}\n${JSON.stringify(r!.analysis)}`).join('\n')}

Return ONLY JSON:
{
  "winner_repo_id": <repo_id of the best repo to contribute to right now>,
  "reasoning": "<2-3 sentences comparing them: health, issue approachability, review culture>",
  "per_repo": [
    { "repo_id": <id>, "verdict": "<one sentence on contribution-worthiness>", "best_for": "<who this repo suits, e.g. 'first-time contributors comfortable with Go'>" }
  ]
}`;

    const data = await complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    let verdict: CompareVerdict;
    try {
      verdict = JSON.parse(data.choices[0].message.content ?? '{}') as CompareVerdict;
    } catch {
      log.error({ ids }, 'compare returned unparseable JSON');
      res.status(502).json({ error: 'comparison failed — try again' });
      return;
    }

    res.json({ comparison: verdict, repos: repos.map((r) => ({ id: r!.id, url: r!.url })) });
  })
);
