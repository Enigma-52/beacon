import type { RepoReport } from './types';

const BASE = '/api';

export async function analyzeRepo(url: string): Promise<{ id: number; status: string }> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as { error: string }).error ?? 'Request failed');
  }

  return res.json();
}

export async function getReport(id: number): Promise<RepoReport> {
  const res = await fetch(`${BASE}/report/${id}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as { error: string }).error ?? 'Request failed');
  }

  return res.json();
}
