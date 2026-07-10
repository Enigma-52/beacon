import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeed, getStats, compareRepos } from '../api';
import type { PlatformStats, CompareVerdict } from '../api';
import type { FeedRepo, FeedResponse } from '../types';
import type { RankedIssue } from '../analysisTypes';
import { IssueResearchDrawer } from '../components/IssueResearchDrawer';
import { Nav } from '../components/Nav';
import { ScoreRing, DifficultyChip, RepoCardSkeleton, timeAgo, compactNumber } from '../components/ui';
import { useBookmarks, toggleBookmark, isBookmarked } from '../lib/bookmarks';

type SortKey = 'recent' | 'stars' | 'issues';
type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

export function FeedPage() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<CompareVerdict | null>(null);
  const [comparing, setComparing] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [researchTarget, setResearchTarget] = useState<{ repoId: number; issue: RankedIssue; repoName: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getFeed()
      .then(setFeed)
      .catch(() => setError('Failed to load feed'))
      .finally(() => setLoading(false));
    getStats().then(setStats).catch(() => {});
  }, []);

  const repos = useMemo(() => {
    let rows = feed?.repos ?? [];
    if (selectedLang) rows = rows.filter((r) => r.language === selectedLang);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
      );
    }
    if (difficulty !== 'all') {
      rows = rows
        .map((r) => ({ ...r, top_issues: r.top_issues.filter((i) => i.difficulty === difficulty) }))
        .filter((r) => r.top_issues.length > 0);
    }
    const sorted = [...rows];
    if (sort === 'stars') sorted.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    else if (sort === 'issues') sorted.sort((a, b) => b.top_issues.length - a.top_issues.length);
    return sorted;
  }, [feed, selectedLang, query, sort, difficulty]);

  function toggleCompare(id: number) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  async function runCompare() {
    if (compareIds.length < 2 || comparing) return;
    setComparing(true);
    try {
      setComparison(await compareRepos(compareIds));
    } catch {
      setComparison(null);
    } finally {
      setComparing(false);
    }
  }

  // Keyboard navigation: / focus search, j/k move, enter open, r research
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') target.blur();
        return;
      }
      if (researchTarget) return;

      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'j') {
        setFocusIdx((i) => Math.min(i + 1, repos.length - 1));
      } else if (e.key === 'k') {
        setFocusIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusIdx >= 0 && repos[focusIdx]) {
        navigate(`/r/${repos[focusIdx].id}`);
      } else if (e.key === 'r' && focusIdx >= 0 && repos[focusIdx]?.top_issues[0]) {
        const repo = repos[focusIdx];
        setResearchTarget({ repoId: repo.id, issue: repo.top_issues[0], repoName: repo.name });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [repos, focusIdx, researchTarget, navigate]);

  return (
    <div className="page-shell">
      <Nav
        right={
          <span style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={() => navigate('/match')}>
              Find my issue
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/analyze')}>
              + Add repo
            </button>
          </span>
        }
      />

      <div className="feed-shell">
        <aside className="sidebar">
          <p className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>Browse by language</p>
          <button className={`lang-btn${!selectedLang ? ' active' : ''}`} onClick={() => setSelectedLang(null)}>
            All <span className="count">{feed?.repos.length ?? 0}</span>
          </button>
          {(feed?.languages ?? []).map((lang) => {
            const count = feed?.repos.filter((r) => r.language === lang).length ?? 0;
            return (
              <button
                key={lang}
                className={`lang-btn${selectedLang === lang ? ' active' : ''}`}
                onClick={() => setSelectedLang(selectedLang === lang ? null : lang)}
              >
                {lang} <span className="count">{count}</span>
              </button>
            );
          })}

          <BookmarksSection />

          <div style={{ marginTop: 'var(--sp-6)' }}>
            <p className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>Keys</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-2)', lineHeight: 2 }}>
              <span className="kbd">/</span> search<br />
              <span className="kbd">j</span> <span className="kbd">k</span> move<br />
              <span className="kbd">↵</span> open repo<br />
              <span className="kbd">r</span> research top issue
            </p>
          </div>
        </aside>

        <main className="feed-main">
          {stats && stats.repos > 0 && (
            <div className="stats-strip fade-in">
              <div className="stat"><span className="value">{stats.repos}</span><span className="label">repos tracked</span></div>
              <div className="stat"><span className="value">{stats.issues_ranked}</span><span className="label">issues ranked</span></div>
              <div className="stat"><span className="value">{stats.research_runs}</span><span className="label">deep dives</span></div>
              {stats.total_tokens > 0 && (
                <div className="stat"><span className="value">{formatTokens(stats.total_tokens)}</span><span className="label">tokens spent</span></div>
              )}
            </div>
          )}

          <div className="filter-bar">
            <input
              ref={searchRef}
              className="input"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocusIdx(-1); }}
              placeholder="Search repos…  ( / )"
              aria-label="Search repos"
            />
            <select
              className="input"
              style={{ width: 'auto', flex: 'none' }}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort repos"
            >
              <option value="recent">Recently analyzed</option>
              <option value="stars">Most stars</option>
              <option value="issues">Most open picks</option>
            </select>
            <select
              className="input"
              style={{ width: 'auto', flex: 'none' }}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}
              aria-label="Filter by difficulty"
            >
              <option value="all">Any difficulty</option>
              <option value="beginner">Beginner only</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {loading && (
            <div className="stagger">
              <span className="sr-only">Loading feed…</span>
              <RepoCardSkeleton />
              <RepoCardSkeleton />
              <RepoCardSkeleton />
            </div>
          )}
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

          {!loading && repos.length === 0 && !error && (
            <div className="empty-state">
              {query || selectedLang ? (
                <p>Nothing matches — clear the search or filter.</p>
              ) : (
                <>
                  <p>No repos analyzed yet.</p>
                  <button className="btn btn-primary" onClick={() => navigate('/analyze')}>
                    Analyze your first repo
                  </button>
                </>
              )}
            </div>
          )}

          <div className="stagger">
            {repos.map((repo, idx) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                focused={idx === focusIdx}
                compareSelected={compareIds.includes(repo.id)}
                onToggleCompare={() => toggleCompare(repo.id)}
                onOpenRepo={() => navigate(`/r/${repo.id}`)}
                onResearchIssue={(issue) => setResearchTarget({ repoId: repo.id, issue, repoName: repo.name })}
              />
            ))}
          </div>
        </main>
      </div>

      {compareIds.length >= 2 && !comparison && (
        <div className="compare-bar rise-in">
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>
            {compareIds.length} repos selected
          </span>
          <button className="btn btn-primary" onClick={runCompare} disabled={comparing}>
            {comparing ? 'Comparing…' : 'Compare'}
          </button>
          <button className="btn btn-ghost" onClick={() => setCompareIds([])}>Clear</button>
        </div>
      )}

      {comparison && (
        <CompareResult
          comparison={comparison}
          repos={feed?.repos ?? []}
          onClose={() => { setComparison(null); setCompareIds([]); }}
        />
      )}

      {researchTarget && (
        <IssueResearchDrawer
          repoId={researchTarget.repoId}
          issue={researchTarget.issue}
          repoName={researchTarget.repoName}
          onClose={() => setResearchTarget(null)}
        />
      )}
    </div>
  );
}

function BookmarksSection() {
  const bookmarks = useBookmarks();
  if (!bookmarks.length) return null;
  return (
    <div style={{ marginTop: 'var(--sp-6)' }}>
      <p className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>Bookmarks</p>
      {bookmarks.map((b) => (
        <div key={`${b.repoId}-${b.number}`} style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 6 }}>
          <button
            onClick={() => toggleBookmark(b)}
            title="Remove bookmark"
            style={{ background: 'none', border: 'none', color: 'var(--beacon)', padding: 0, fontSize: 12 }}
          >
            ★
          </button>
          <a
            href={b.github_url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 'var(--text-xs)', color: 'var(--muted)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
            }}
            title={`${b.repoName} #${b.number} ${b.title}`}
          >
            #{b.number} {b.title}
          </a>
        </div>
      ))}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function CompareResult({
  comparison,
  repos,
  onClose,
}: {
  comparison: CompareVerdict;
  repos: FeedRepo[];
  onClose: () => void;
}) {
  const nameOf = (id: number) => repos.find((r) => r.id === id)?.name ?? `repo ${id}`;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Comparison result"
        className="rise-in"
        style={{
          position: 'fixed', top: '14vh', left: '50%', transform: 'translateX(-50%)',
          width: 'min(620px, 92vw)', zIndex: 60, background: 'var(--bg-raised)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-2)', padding: 'var(--sp-5)', maxHeight: '70vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
          <span className="eyebrow">Where to contribute first</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16 }}>✕</button>
        </div>
        <p style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--beacon)', marginBottom: 'var(--sp-2)' }}>
          {nameOf(comparison.winner_repo_id)}
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.7, marginBottom: 'var(--sp-4)' }}>
          {comparison.reasoning}
        </p>
        {comparison.per_repo.map((r) => (
          <div key={r.repo_id} className="card" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
            <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{nameOf(r.repo_id)}</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', margin: 0 }}>{r.verdict}</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-2)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
              best for: {r.best_for}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function RepoCard({
  repo,
  focused,
  compareSelected,
  onToggleCompare,
  onOpenRepo,
  onResearchIssue,
}: {
  repo: FeedRepo;
  focused: boolean;
  compareSelected: boolean;
  onToggleCompare: () => void;
  onOpenRepo: () => void;
  onResearchIssue: (issue: RankedIssue) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`repo-card card-hover${focused ? ' keyboard-focus' : ''}`}>
      <div className="repo-card-header" onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <button className="repo-name" onClick={(e) => { e.stopPropagation(); onOpenRepo(); }}>
              {repo.name}
            </button>
            {repo.top_issues.length > 0 && (
              <span className="chip chip-warn">
                {repo.top_issues.length} pick{repo.top_issues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {repo.description && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              {repo.description}
            </p>
          )}
          <div className="repo-meta">
            {repo.language && <span>lang <strong>{repo.language}</strong></span>}
            {repo.stars != null && <span>★ <strong>{compactNumber(repo.stars)}</strong></span>}
            <span>analyzed <strong>{timeAgo(repo.last_analyzed)}</strong></span>
          </div>
        </div>
        <span style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
            className={`chip ${compareSelected ? 'chip-warn' : 'chip-muted'}`}
            style={{ cursor: 'pointer' }}
            title="Select for comparison"
          >
            {compareSelected ? 'comparing' : 'compare'}
          </button>
          <span style={{ color: 'var(--muted-2)', fontSize: 'var(--text-xs)' }} aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        </span>
      </div>

      {expanded && repo.top_issues.length > 0 && (
        <div>
          {repo.top_issues.map((issue) => (
            <div key={issue.number} className="issue-row" onClick={() => onResearchIssue(issue)}>
              <ScoreRing score={issue.score} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={issue.github_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'var(--text)', fontSize: 'var(--text-sm)', fontWeight: 500 }}
                >
                  #{issue.number} {issue.title}
                </a>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                {repo.researched_issues?.includes(issue.number) && (
                  <span className="chip chip-sea" title="Deep research available — click to view">✓ researched</span>
                )}
                <DifficultyChip difficulty={issue.difficulty} />
                {issue.signals?.no_comments && <Dot color="var(--ok)" title="No comments" />}
                {issue.signals?.is_fresh && <Dot color="var(--warn)" title="Fresh" />}
                <BookmarkStar repo={repo} issue={issue} />
                <span className="research-hint">deep research →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkStar({ repo, issue }: { repo: FeedRepo; issue: RankedIssue }) {
  const bookmarks = useBookmarks();
  void bookmarks; // subscribe so the star re-renders on toggle
  const saved = isBookmarked(repo.id, issue.number);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleBookmark({
          repoId: repo.id,
          repoName: repo.name,
          number: issue.number,
          title: issue.title,
          github_url: issue.github_url,
        });
      }}
      title={saved ? 'Remove bookmark' : 'Bookmark this issue'}
      aria-label={saved ? 'Remove bookmark' : 'Bookmark this issue'}
      style={{
        background: 'none', border: 'none', padding: '0 2px', fontSize: 13,
        color: saved ? 'var(--beacon)' : 'var(--muted-2)',
      }}
    >
      {saved ? '★' : '☆'}
    </button>
  );
}

function Dot({ color, title }: { color: string; title: string }) {
  return <span title={title} style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />;
}
