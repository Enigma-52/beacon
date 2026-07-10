/**
 * Repo Chat — Q&A grounded in the stored analysis. One streamed completion
 * per message, no agent loop, no live GitHub calls: cheap by construction.
 *
 * The model is asked to end its answer with a FOLLOWUPS marker; the marker is
 * held back from the stream and parsed into suggested follow-up questions.
 */
import { completeStream } from './openrouter';
import type { ChatMessage } from './openrouter';
import type { ChatTurn } from '../dao/conversations';

const FOLLOWUP_MARKER = '|||FOLLOWUPS:';
const HISTORY_TURNS = 6;

export interface ChatAnswer {
  answer: string;
  followups: string[];
}

interface RepoContext {
  url: string;
  analysis: unknown;
  github_data: unknown;
}

function buildSystemPrompt(repo: RepoContext): string {
  const name = repo.url.replace('https://github.com/', '');
  return `You are Beacon, an assistant that helps contributors navigate the GitHub repo ${name}.

You answered from a stored analysis of the repo — issues ranked for approachability, an architecture summary with module ownership, a health snapshot, and suggested starting points. Ground every answer in this data. If the answer isn't in the data, say so plainly and suggest what to check on GitHub instead. Never invent issue numbers, file paths, or maintainer names.

Stored analysis:
${JSON.stringify(repo.analysis)}

Repo record:
${JSON.stringify(repo.github_data)}

Formatting rules:
- Be concise and concrete. Reference issue numbers, file paths, and @usernames from the data.
- Use markdown lists/code where helpful.
- After your answer, on a new line, output exactly: ${FOLLOWUP_MARKER}["question 1","question 2"] — two short follow-up questions the user might ask next. Nothing after it.`;
}

/**
 * Streams the answer via onToken (marker held back), returns the full answer
 * plus parsed follow-up suggestions.
 */
export async function askRepo(
  repo: RepoContext,
  history: ChatTurn[],
  question: string,
  onToken: (text: string) => void,
  signal?: AbortSignal
): Promise<ChatAnswer> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(repo) },
    ...history.slice(-HISTORY_TURNS).map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: question },
  ];

  // Hold back a tail so the marker never leaks into the stream even when it
  // arrives split across chunks.
  let pending = '';
  let markerSeen = false;

  const full = await completeStream(
    { messages, temperature: 0.4, maxTokens: 1200, signal },
    (text) => {
      if (markerSeen) return;
      pending += text;
      const idx = pending.indexOf(FOLLOWUP_MARKER);
      if (idx !== -1) {
        markerSeen = true;
        const visible = pending.slice(0, idx);
        if (visible) onToken(visible);
        return;
      }
      const safe = pending.length - FOLLOWUP_MARKER.length;
      if (safe > 0) {
        onToken(pending.slice(0, safe));
        pending = pending.slice(safe);
      }
    }
  );

  // Flush any held-back tail that turned out not to be a marker
  if (!markerSeen && pending) onToken(pending);

  const markerIdx = full.indexOf(FOLLOWUP_MARKER);
  const answer = (markerIdx === -1 ? full : full.slice(0, markerIdx)).trim();

  let followups: string[] = [];
  if (markerIdx !== -1) {
    try {
      const parsed: unknown = JSON.parse(full.slice(markerIdx + FOLLOWUP_MARKER.length).trim());
      if (Array.isArray(parsed)) {
        followups = parsed.filter((q): q is string => typeof q === 'string').slice(0, 3);
      }
    } catch {
      /* malformed followups are not worth failing the answer over */
    }
  }

  return { answer, followups };
}
