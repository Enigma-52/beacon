import { useRef, useState } from 'react';
import { searchGithub } from '../api';
import type { GhSearchResult } from '../api';
import { compactNumber } from './ui';

interface Props {
  onAnalyze: (url: string) => void;
  disabled: boolean;
}

/** Search GitHub from inside Beacon and analyze a repo in one click. */
export function DiscoverPanel({ onAnalyze, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GhSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(q: string) {
    setQuery(q);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchGithub(q.trim()));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 450);
  }

  return (
    <section style={{ marginTop: 'var(--sp-6)' }} aria-label="Discover repos">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
        <span className="eyebrow">or discover something to contribute to</span>
        <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
      </div>

      <input
        className="input"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search GitHub — try “terminal rust” or “react state”…"
        aria-label="Search GitHub repositories"
      />

      {searching && <p style={{ marginTop: 'var(--sp-3)', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>Searching GitHub…</p>}
      {error && <p style={{ marginTop: 'var(--sp-3)', color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}

      {results && !searching && (
        <div className="stagger" style={{ marginTop: 'var(--sp-3)' }}>
          {results.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>No repos found for that search.</p>
          )}
          {results.map((r) => (
            <div key={r.full_name} className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <a href={r.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                    {r.full_name}
                  </a>
                  <span className="repo-meta" style={{ marginTop: 0 }}>
                    {r.language && <span>{r.language}</span>}
                    <span>★ {compactNumber(r.stars)}</span>
                  </span>
                </div>
                {r.description && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.description}
                  </p>
                )}
              </div>
              <button className="btn btn-ghost" disabled={disabled} onClick={() => onAnalyze(r.url)}>
                Analyze
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
