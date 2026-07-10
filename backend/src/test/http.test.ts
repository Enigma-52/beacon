import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWithRetry } from '../services/http';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockResponses(...statuses: number[]) {
  const calls: number[] = [];
  global.fetch = vi.fn(async () => {
    const status = statuses[Math.min(calls.length, statuses.length - 1)];
    calls.push(status);
    return new Response('{}', { status });
  }) as unknown as typeof fetch;
  return calls;
}

describe('fetchWithRetry', () => {
  it('returns immediately on success', async () => {
    const calls = mockResponses(200);
    const res = await fetchWithRetry('http://x/', {}, { retries: 3 });
    expect(res.status).toBe(200);
    expect(calls.length).toBe(1);
  });

  it('does not retry client errors like 404', async () => {
    const calls = mockResponses(404);
    const res = await fetchWithRetry('http://x/', {}, { retries: 3 });
    expect(res.status).toBe(404);
    expect(calls.length).toBe(1);
  });

  it('retries 503 and succeeds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic minimal backoff
    const calls = mockResponses(503, 200);
    const res = await fetchWithRetry('http://x/', {}, { retries: 2 });
    expect(res.status).toBe(200);
    expect(calls.length).toBe(2);
  }, 10_000);

  it('gives up after exhausting retries and returns last response', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const calls = mockResponses(500);
    const res = await fetchWithRetry('http://x/', {}, { retries: 1 });
    expect(res.status).toBe(500);
    expect(calls.length).toBe(2);
  }, 10_000);

  it('aborts immediately when caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchWithRetry('http://x/', {}, { retries: 3, signal: controller.signal })
    ).rejects.toThrow();
  });
});
