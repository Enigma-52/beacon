import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeed, getStats } from '../api';
import type { PlatformStats } from '../api';
import type { FeedRepo, FeedResponse } from '../types';
import type { RankedIssue } from '../analysisTypes';
import { IssueResearchDrawer } from '../components/IssueResearchDrawer';
import { Nav } from '../components/Nav';
import { ScoreRing, DifficultyChip, RepoCardSkeleton, timeAgo } from '../components/ui';
import { useBookmarks, toggleBookmark, isBookmarked } from '../lib/bookmarks';

type SortKey = 'recent' | 'stars' | 'issues';

export function FeedPage() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
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
    const sorted = [...rows];
    if (sort === 'stars') sorted.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    else if (sort === 'issues') sorted.sort((a, b) => b.top_issues.length - a.top_issues.length);
    return sorted;
  }, [feed, selectedLang, query, sort]);

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
                onOpenRepo={() => navigate(`/r/${repo.id}`)}
                onResearchIssue={(issue) => setResearchTarget({ repoId: repo.id, issue, repoName: repo.name })}
              />
            ))}
          </div>
        </main>
      </div>

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

function RepoCard({
  repo,
  focused,
  onOpenRepo,
  onResearchIssue,
}: {
  repo: FeedRepo;
  focused: boolean;
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
            {repo.stars != null && <span>★ <strong>{repo.stars.toLocaleString()}</strong></span>}
            <span>analyzed <strong>{timeAgo(repo.last_analyzed)}</strong></span>
          </div>
        </div>
        <span style={{ color: 'var(--muted-2)', fontSize: 'var(--text-xs)', marginTop: '2px' }} aria-hidden="true">
          {expanded ? '▲' : '▼'}
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
