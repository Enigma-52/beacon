import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeed } from '../api';
import type { FeedRepo } from '../types';

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** ⌘K / Ctrl-K palette: jump to repos and core actions. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [repos, setRepos] = useState<FeedRepo[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIdx(0);
    getFeed().then((f) => setRepos(f.repos)).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: 'feed', label: 'Go to feed', hint: 'browse tracked repos', run: () => navigate('/') },
      { id: 'analyze', label: 'Analyze a new repo', hint: 'paste a GitHub URL', run: () => navigate('/analyze') },
      { id: 'match', label: 'Find my issue', hint: 'match issues to your skills', run: () => navigate('/match') },
    ];
    const repoCmds: Command[] = repos.map((r) => ({
      id: `repo-${r.id}`,
      label: r.name,
      hint: 'open report',
      run: () => navigate(`/r/${r.id}`),
    }));
    const all = [...base, ...repoCmds];
    const q = query.trim().toLowerCase();
    return q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
  }, [repos, query, navigate]);

  if (!open) return null;

  function runCommand(c: Command | undefined) {
    if (!c) return;
    setOpen(false);
    c.run();
  }

  return (
    <>
      <div className="drawer-overlay" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-label="Command palette"
        style={{
          position: 'fixed', top: '18vh', left: '50%', transform: 'translateX(-50%)',
          width: 'min(560px, 92vw)', zIndex: 60,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-2)', overflow: 'hidden',
        }}
        className="rise-in"
      >
        <input
          ref={inputRef}
          className="input"
          style={{ border: 'none', borderBottom: '1px solid var(--border-soft)', borderRadius: 0, padding: '14px 16px', background: 'transparent' }}
          value={query}
          placeholder="Jump to a repo or action…"
          onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, commands.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter') runCommand(commands[idx]);
          }}
        />
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 'var(--sp-2)' }}>
          {commands.length === 0 && (
            <p style={{ padding: 'var(--sp-3)', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>No matches.</p>
          )}
          {commands.map((c, i) => (
            <button
              key={c.id}
              onClick={() => runCommand(c)}
              onMouseEnter={() => setIdx(i)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '10px 12px', border: 'none', textAlign: 'left',
                borderRadius: 'var(--r-sm)', fontSize: 'var(--text-sm)',
                background: i === idx ? 'var(--beacon-dim)' : 'transparent',
                color: i === idx ? 'var(--beacon)' : 'var(--text)',
              }}
            >
              <span>{c.label}</span>
              {c.hint && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }}>{c.hint}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-soft)', display: 'flex', gap: 12 }}>
          <span className="kbd">↑↓</span>
          <span className="kbd">↵</span>
          <span className="kbd">esc</span>
        </div>
      </div>
    </>
  );
}
