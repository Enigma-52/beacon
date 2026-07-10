import { log } from './logger';

export interface RetryOptions {
  /** Attempts after the first try. Default 3. */
  retries?: number;
  /** Per-attempt timeout. Default 30s. */
  timeoutMs?: number;
  /** Caller cancellation — aborts immediately, never retried. */
  signal?: AbortSignal;
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function backoffMs(attempt: number, res?: Response): number {
  const retryAfter = res?.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!isNaN(seconds)) return Math.min(seconds * 1000, 30_000);
  }
  const base = 500 * 2 ** attempt;
  return base + Math.random() * base;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => { clearTimeout(t); reject(new Error('aborted')); },
      { once: true }
    );
  });
}

/**
 * fetch with per-attempt timeout and exponential backoff on 408/429/5xx and
 * network errors. Honors Retry-After. A caller-supplied signal cancels
 * everything immediately and is never retried.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {}
): Promise<Response> {
  const { retries = 3, timeoutMs = 30_000, signal } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new Error('aborted');

    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    let res: Response | undefined;
    try {
      res = await fetch(url, { ...init, signal: combined });
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }

    if (res && !RETRYABLE_STATUSES.has(res.status)) return res;

    if (attempt < retries) {
      const wait = backoffMs(attempt, res);
      log.warn({ url, status: res?.status, attempt: attempt + 1, wait }, 'retrying request');
      await sleep(wait, signal);
    } else if (res) {
      return res;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`request failed: ${url}`);
}
