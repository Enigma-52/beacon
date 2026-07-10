import { Router, Request, Response } from 'express';
import { fetchWithRetry } from '../services/http';
import { asyncRoute } from '../middleware/errors';

export const discoverRouter = Router();

interface SearchResult {
  full_name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  good_first_issues: number;
}

/** GitHub search is rate-limited (10/min unauthenticated) — cache hard. */
const cache = new Map<string, { at: number; results: SearchResult[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'beacon-app',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token && token.startsWith('gh')) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Search GitHub repos to analyze — powers in-app discovery. */
discoverRouter.get(
  '/gh-search',
  asyncRoute(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length > 100) {
      res.status(400).json({ error: 'q (1–100 chars) is required' });
      return;
    }

    const key = q.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      res.json({ results: hit.results, cached: true });
      return;
    }

    const params = new URLSearchParams({
      q: `${q} in:name,description stars:>50`,
      sort: 'stars',
      order: 'desc',
      per_page: '8',
    });
    const ghRes = await fetchWithRetry(
      `https://api.github.com/search/repositories?${params}`,
      { headers: ghHeaders() },
      { retries: 1, timeoutMs: 10_000 }
    );

    if (!ghRes.ok) {
      res.status(502).json({ error: 'GitHub search unavailable — try again shortly' });
      return;
    }

    const data = (await ghRes.json()) as { items?: Record<string, unknown>[] };
    const results: SearchResult[] = (data.items ?? []).map((r) => ({
      full_name: r.full_name as string,
      description: (r.description as string | null)?.slice(0, 160) ?? null,
      language: (r.language as string | null) ?? null,
      stars: r.stargazers_count as number,
      url: r.html_url as string,
      good_first_issues: (r.open_issues_count as number) ?? 0,
    }));

    cache.set(key, { at: Date.now(), results });
    if (cache.size > 200) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      cache.delete(oldest[0]);
    }

    res.json({ results, cached: false });
  })
);
