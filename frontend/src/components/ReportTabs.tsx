import { useState } from 'react';
import type { RepoReport } from '../types';
import type { Analysis, RankedIssue, StartingPoint } from '../analysisTypes';

const TABS = [
  { key: 'issues', label: 'Issues' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'health', label: 'Health' },
  { key: 'starting_points', label: 'Start Here' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface Props {
  report: RepoReport;
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
};

export function ReportTabs({ report }: Props) {
  const [active, setActive] = useState<TabKey>('issues');
  const analysis = report.analysis as Analysis | null;

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--muted)' }}>
        <a href={report.url} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>{report.url}</a>
        {' — '}<StatusBadge status={report.status} />
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: active === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: active === tab.key ? 'var(--accent)' : 'var(--muted)',
              fontWeight: active === tab.key ? 600 : 400,
              marginBottom: '-1px',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '120px' }}>
        {!analysis ? (
          <p style={{ color: 'var(--muted)' }}>No data yet.</p>
        ) : active === 'issues' ? (
          <IssuesTab issues={analysis.issues} />
        ) : active === 'architecture' ? (
          <ArchitectureTab arch={analysis.architecture} />
        ) : active === 'health' ? (
          <HealthTab health={analysis.health} />
        ) : (
          <StartHereTab points={analysis.starting_points} />
        )}
      </div>
    </div>
  );
}

function IssuesTab({ issues }: { issues: RankedIssue[] }) {
  if (!issues?.length) return <p style={{ color: 'var(--muted)' }}>No issues found.</p>;
  const sorted = [...issues].sort((a, b) => b.score - a.score);
  return (
    <>
      {sorted.map((issue) => (
        <div key={issue.number} style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <ScoreBadge score={issue.score} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <a
                  href={issue.github_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}
                >
                  #{issue.number} {issue.title}
                </a>
                <DifficultyTag difficulty={issue.difficulty} />
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 8px' }}>{issue.reason}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {issue.signals?.no_comments && <Signal label="No comments" color="#4ade80" title="Completely fresh — no discussion yet" />}
                {issue.signals?.no_related_prs && <Signal label="No prior PRs" color="#60a5fa" title="Never been attempted" />}
                {issue.signals?.is_fresh && <Signal label="New" color="#f59e0b" title="Opened in the last 30 days" />}
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function ArchitectureTab({ arch }: { arch: Analysis['architecture'] }) {
  if (!arch) return <p style={{ color: 'var(--muted)' }}>No data.</p>;
  return (
    <>
      <div style={card}>
        <h3 style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>OVERVIEW</h3>
        <p style={{ fontSize: '14px', lineHeight: 1.7 }}>{arch.summary}</p>
      </div>

      {arch.key_modules?.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 600 }}>KEY MODULES</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {arch.key_modules.map((m) => (
              <code key={m} style={{ background: '#111', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px', fontSize: '12px' }}>
                {m}
              </code>
            ))}
          </div>
        </div>
      )}

      {Object.keys(arch.ownership ?? {}).length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 600 }}>OWNERSHIP</h3>
          {Object.entries(arch.ownership).map(([module, owners]) => (
            <div key={module} style={{ marginBottom: '10px' }}>
              <code style={{ fontSize: '12px', color: '#93c5fd' }}>{module}</code>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {owners.map((ownerUrl) => {
                  const login = ownerUrl.replace('https://github.com/', '');
                  return (
                    <a
                      key={ownerUrl}
                      href={ownerUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      @{login}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function HealthTab({ health }: { health: Analysis['health'] }) {
  if (!health) return <p style={{ color: 'var(--muted)' }}>No data.</p>;
  const trendColor = { growing: '#4ade80', stable: '#60a5fa', declining: '#f87171', unknown: '#888' }[health.trend] ?? '#888';
  return (
    <>
      <div style={card}>
        <p style={{ fontSize: '14px', lineHeight: 1.7 }}>{health.summary}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Metric label="Activity" value={health.activity} />
        <Metric label="PR merge speed" value={health.pr_merge_speed} />
        <Metric label="Contributor concentration" value={health.contributor_concentration} />
        <Metric label="Trend" value={health.trend} valueStyle={{ color: trendColor, fontWeight: 600 }} />
      </div>
    </>
  );
}

function StartHereTab({ points }: { points: StartingPoint[] }) {
  if (!points?.length) return <p style={{ color: 'var(--muted)' }}>No suggestions.</p>;
  return (
    <>
      {points.map((p, i) => (
        <div key={i} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700, minWidth: '20px' }}>{i + 1}</span>
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}
            >
              {p.name}
            </a>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 0 30px' }}>{p.reason}</p>
        </div>
      ))}
    </>
  );
}

// ─── Small components ──────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? '#4ade80' : score >= 5 ? '#f59e0b' : '#f87171';
  return (
    <div style={{
      minWidth: '36px', height: '36px', borderRadius: '8px', background: color + '22',
      border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14px', fontWeight: 700, color,
    }}>
      {score}
    </div>
  );
}

function DifficultyTag({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = { beginner: '#4ade80', intermediate: '#f59e0b', advanced: '#f87171' };
  const c = colors[difficulty] ?? '#888';
  return (
    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: c + '22', color: c, border: `1px solid ${c}44` }}>
      {difficulty}
    </span>
  );
}

function Signal({ label, color, title }: { label: string; color: string; title: string }) {
  return (
    <span title={title} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: color + '15', color, border: `1px solid ${color}33`, cursor: 'help' }}>
      {label}
    </span>
  );
}

function Metric({ label, value, valueStyle }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div style={{ ...card, marginBottom: 0 }}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', fontWeight: 600 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '14px', ...valueStyle }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: RepoReport['status'] }) {
  const colors: Record<RepoReport['status'], string> = {
    pending: '#888', fetching: '#f59e0b', analyzing: '#3b82f6', done: '#22c55e', error: '#ef4444',
  };
  return <span style={{ color: colors[status], fontWeight: 600 }}>{status}</span>;
}
