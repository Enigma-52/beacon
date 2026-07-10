import { useEffect, useRef, useState } from 'react';
import { askQuestion, getConversation } from '../api';
import type { ConversationTurn } from '../api';
import { MarkdownLite } from '../lib/markdown';

function sessionId(): string {
  let id = localStorage.getItem('beacon_session');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('beacon_session', id);
  }
  return id;
}

interface Bubble {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const STARTERS = [
  'Where should I start contributing?',
  'Which issue is the best first pick and why?',
  'Who should review my PR?',
];

export function ChatPanel({ repoId }: { repoId: number }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [followups, setFollowups] = useState<string[]>(STARTERS);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getConversation(repoId, sessionId()).then((turns: ConversationTurn[]) => {
      if (turns.length) {
        setBubbles(turns.map((t) => ({ role: t.role, content: t.content })));
        setFollowups([]);
      }
    });
  }, [repoId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [bubbles]);

  useEffect(() => () => abortRef.current?.(), []);

  function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    setBusy(true);
    setInput('');
    setFollowups([]);
    setBubbles((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '', streaming: true }]);

    abortRef.current = askQuestion(repoId, q, sessionId(), {
      onToken: (text) => {
        setBubbles((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + text };
          return next;
        });
      },
      onFollowups: (questions) => setFollowups(questions),
      onDone: () => {
        setBubbles((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], streaming: false };
          return next;
        });
        setBusy(false);
      },
      onError: (message) => {
        setBubbles((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            streaming: false,
            content: last.content || `Couldn't answer that: ${message}`,
          };
          return next;
        });
        setBusy(false);
      },
    });
  }

  return (
    <section className="chat-panel rise-in" aria-label="Repo chat">
      <div className="chat-header">
        <span className="eyebrow">Ask this repo</span>
        <span className="nav-tagline">grounded in the analysis — no hallucinated files</span>
      </div>

      {bubbles.length > 0 && (
        <div className="chat-messages">
          {bubbles.map((b, i) => (
            <div key={i} className={`chat-bubble ${b.role}${b.streaming ? ' streaming' : ''}`}>
              {b.role === 'assistant' ? <MarkdownLite text={b.content} /> : b.content}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {followups.length > 0 && !busy && (
        <div className="chat-followups">
          {followups.map((q) => (
            <button key={q} className="followup-chip" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      )}

      <form
        className="chat-input-row"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this repo…"
          disabled={busy}
          aria-label="Ask a question about this repo"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
          {busy ? 'Answering…' : 'Ask'}
        </button>
      </form>
    </section>
  );
}
