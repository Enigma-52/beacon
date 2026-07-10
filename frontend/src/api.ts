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

export interface PlatformStats {
  repos: number;
  reports: number;
  issues_ranked: number;
  research_runs: number;
  total_tokens: number;
}

export async function getStats(): Promise<PlatformStats> {
  const res = await fetch(`${BASE}/stats`);
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}

export interface ChatStreamHandlers {
  onToken: (text: string) => void;
  onFollowups: (questions: string[]) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/** POST /ask and consume the SSE stream. Returns an abort function. */
export function askQuestion(
  repoId: number,
  question: string,
  sessionId: string,
  handlers: ChatStreamHandlers
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId, question, session_id: sessionId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Chat failed' }));
        handlers.onError((err as { error: string }).error ?? 'Chat failed');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const eventMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const data = JSON.parse(dataMatch[1]) as Record<string, unknown>;
          switch (eventMatch[1]) {
            case 'token': handlers.onToken(data.text as string); break;
            case 'followups': handlers.onFollowups((data.questions as string[]) ?? []); break;
            case 'done': handlers.onDone(); break;
            case 'error': handlers.onError((data.message as string) ?? 'Chat failed'); break;
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        handlers.onError(e instanceof Error ? e.message : 'Chat failed');
      }
    }
  })();

  return () => controller.abort();
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function getConversation(repoId: number, sessionId: string): Promise<ConversationTurn[]> {
  const res = await fetch(`${BASE}/conversations/${repoId}?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { messages: ConversationTurn[] };
  return data.messages;
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
