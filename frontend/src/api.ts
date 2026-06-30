import type { RepoReport, FeedResponse, IssueResearchResponse, MatchResponse } from './types';

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

export async function cancelAnalysis(id: number): Promise<void> {
  await fetch(`${BASE}/cancel/${id}`, { method: 'POST' });
}

export async function getFeed(): Promise<FeedResponse> {
  const res = await fetch(`${BASE}/feed`);
  if (!res.ok) throw new Error('Failed to load feed');
  return res.json();
}

export async function getIssueResearch(repoId: number, issueNumber: number): Promise<IssueResearchResponse> {
  const res = await fetch(`${BASE}/research/${repoId}/${issueNumber}`);
  if (res.status === 404) throw new Error('not_found');
  if (!res.ok) throw new Error('Failed to load research');
  return res.json();
}

export async function cancelIssueResearch(repoId: number, issueNumber: number): Promise<void> {
  await fetch(`${BASE}/research/${repoId}/${issueNumber}/cancel`, { method: 'POST' });
}

export async function runIssueResearch(repoId: number, issueNumber: number): Promise<IssueResearchResponse> {
  const res = await fetch(`${BASE}/research/${repoId}/${issueNumber}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as { error: string }).error);
  }
  return res.json();
}

export async function getMatches(skills: string[], level: string, interests?: string[]): Promise<MatchResponse> {
  const res = await fetch(`${BASE}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills, level, interests }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as { error: string }).error);
  }
  return res.json();
}
