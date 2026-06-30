import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeed } from '../api';
import type { FeedRepo, FeedResponse } from '../types';
import type { RankedIssue } from '../analysisTypes';
import { IssueResearchDrawer } from '../components/IssueResearchDrawer';

export function FeedPage() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [researchTarget, setResearchTarget] = useState<{ repoId: number; issue: RankedIssue; repoName: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getFeed()
      .then(setFeed)
      .catch(() => setError('Failed to load feed'))
      .finally(() => setLoading(false));
  }, []);

  const repos = feed?.repos.filter((r) => !selectedLang || r.language === selectedLang) ?? [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.3px' }}>Beacon</span>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
            background: '#5b8ef015', color: 'var(--accent)', border: '1px solid #5b8ef030',
          }}>BETA</span>
        </div>
        <button
          onClick={() => navigate('/analyze')}
          style={{
            padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          + Add repo
        </button>
      </nav>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <aside style={{
          width: '220px',
          minWidth: '220px',
          borderRight: '1px solid var(--border)',
          padding: '24px 16px',
          position: 'sticky',
          top: '52px',
          height: 'calc(100vh - 52px)',
          overflowY: 'auto',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: '12px' }}>
            BROWSE BY LANGUAGE
          </p>
          <button
            onClick={() => setSelectedLang(null)}
            style={langBtn(!selectedLang)}
          >
            All <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>{feed?.repos.length ?? 0}</span>
          </button>
          {(feed?.languages ?? []).map((lang) => {
            const count = feed?.repos.filter((r) => r.language === lang).length ?? 0;
            return (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                style={langBtn(selectedLang === lang)}
              >
                {lang} <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>{count}</span>
              </button>
            );
          })}
        </aside>

        {/* Feed */}
        <main style={{ flex: 1, padding: '32px 40px', maxWidth: '860px' }}>
          {loading && <p style={{ color: 'var(--muted)' }}>Loading feed…</p>}
          {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
          {!loading && repos.length === 0 && !error && (
            <div style={{ textAlign: 'center', paddingTop: '80px', color: 'var(--muted)' }}>
              <p style={{ fontSize: '18px', marginBottom: '12px' }}>No repos analyzed yet.</p>
              <button
                onClick={() => navigate('/analyze')}
                style={{
                  padding: '10px 20px', borderRadius: '8px', background: 'var(--accent)',
                  color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                }}
              >
                Analyze your first repo
              </button>
            </div>
          )}
          {repos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              onOpenRepo={() => navigate(`/r/${repo.id}`)}
              onResearchIssue={(issue) => setResearchTarget({ repoId: repo.id, issue, repoName: repo.name })}
            />
          ))}
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

function langBtn(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    padding: '7px 10px',
    marginBottom: '4px',
    borderRadius: '6px',
    border: 'none',
    background: active ? '#5b8ef018' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text)',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: active ? 600 : 400,
  };
}

function RepoCard({
  repo,
  onOpenRepo,
  onResearchIssue,
}: {
  repo: FeedRepo;
  onOpenRepo: () => void;
  onResearchIssue: (issue: RankedIssue) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '10px',
      marginBottom: '16px',
      background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      {/* Repo header */}
      <div
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenRepo(); }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: '16px' }}
            >
              {repo.name}
            </button>
            {repo.top_issues.length > 0 && (
              <span style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                background: '#5b8ef018', color: 'var(--accent)', border: '1px solid #5b8ef030', fontWeight: 600,
              }}>
                {repo.top_issues.length} issue{repo.top_issues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {repo.description && (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{repo.description}</p>
          )}
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--muted-2)' }}>
            {repo.language && <span>lang: <code style={{ color: 'var(--muted)' }}>{repo.language}</code></span>}
            {repo.stars != null && <span>stars: <code style={{ color: 'var(--muted)' }}>{repo.stars.toLocaleString()}</code></span>}
            <span>analyzed: <code style={{ color: 'var(--muted)' }}>{timeAgo(repo.last_analyzed)}</code></span>
          </div>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '12px', marginLeft: '16px', marginTop: '2px' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Issue list */}
      {expanded && repo.top_issues.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-soft)' }}>
          {repo.top_issues.map((issue) => (
            <div
              key={issue.number}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 20px',
                borderBottom: '1px solid var(--border-soft)',
                cursor: 'pointer',
              }}
              onClick={() => onResearchIssue(issue)}
            >
              <ScoreChip score={issue.score} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={issue.github_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}
                >
                  #{issue.number} {issue.title}
                </a>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <DifficultyChip d={issue.difficulty} />
                {issue.signals?.no_comments && <Dot color="#4ade80" title="No comments" />}
                {issue.signals?.is_fresh && <Dot color="#f59e0b" title="Fresh" />}
                <span style={{ fontSize: '11px', color: 'var(--muted-2)', marginLeft: '4px' }}>Deep research →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreChip({ score }: { score: number }) {
  const color = score >= 8 ? '#4ade80' : score >= 5 ? '#f59e0b' : '#f87171';
  return (
    <div style={{
      minWidth: '28px', height: '28px', borderRadius: '6px', background: color + '22',
      border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: 700, color, flexShrink: 0,
    }}>
      {score}
    </div>
  );
}

function DifficultyChip({ d }: { d: string }) {
  const c: Record<string, string> = { beginner: '#4ade80', intermediate: '#f59e0b', advanced: '#f87171' };
  const color = c[d] ?? '#888';
  return (
    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '999px', background: color + '18', color, border: `1px solid ${color}33` }}>
      {d}
    </span>
  );
}

function Dot({ color, title }: { color: string; title: string }) {
  return <span title={title} style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
