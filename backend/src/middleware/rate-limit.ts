import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Per-IP token bucket. Buckets refill continuously at perMin/60 tokens per
 * second; idle buckets are swept to keep memory bounded.
 */
export function rateLimit(perMin?: number) {
  const limit = perMin ?? Number(process.env.RATE_LIMIT_PER_MIN) ?? 20;
  const capacity = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const buckets = new Map<string, Bucket>();

  const sweeper = setInterval(() => {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [ip, b] of buckets) {
      if (b.lastRefill < cutoff) buckets.delete(ip);
    }
  }, 60_000);
  sweeper.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();

    let bucket = buckets.get(ip);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      buckets.set(ip, bucket);
    }

    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * (capacity / 60));
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      res.status(429).json({ error: 'rate limited' });
      return;
    }

    bucket.tokens -= 1;
    next();
  };
}
