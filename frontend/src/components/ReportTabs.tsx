import { useState } from 'react';
import type { RepoReport } from '../types';
import type { Analysis, RankedIssue, StartingPoint } from '../analysisTypes';
import { ScoreRing, DifficultyChip, SignalChip } from './ui';

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

export function ReportTabs({ report }: Props) {
  const [active, setActive] = useState<TabKey>('issues');
  const analysis = report.analysis as Analysis | null;
  const meta = report.meta;

  return (
    <div style={{ marginTop: 'var(--sp-6)' }}>
      <div style={{ marginBottom: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: 'var(--muted)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={report.url} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)' }}>
          {report.url.replace('https://github.com/', '')}
        </a>
        <StatusBadge status={report.status} />
        {meta?.total_tokens != null && (
          <span className="chip chip-muted" title={`Model: ${meta.model ?? 'unknown'} · ${meta.iterations ?? '?'} iterations`}>
            {meta.total_tokens.toLocaleString()} tokens
          </span>
        )}
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            className={`tab${active === tab.key ? ' active' : ''}`}
            onClick={() => setActive(tab.key)}
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
    <div className="stagger">
      {sorted.map((issue) => (
        <div key={issue.number} className="card card-hover">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
            <ScoreRing score={issue.score} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: '4px' }}>
                <a
                  href={issue.github_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--text-strong)', fontWeight: 600 }}
                >
                  #{issue.number} {issue.title}
                </a>
                <DifficultyChip difficulty={issue.difficulty} />
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: '0 0 8px' }}>{issue.reason}</p>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                {issue.signals?.no_comments && <SignalChip label="No comments" tone="ok" title="Completely fresh — no discussion yet" />}
                {issue.signals?.no_related_prs && <SignalChip label="No prior PRs" tone="sea" title="Never been attempted" />}
                {issue.signals?.is_fresh && <SignalChip label="New" tone="warn" title="Opened in the last 30 days" />}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchitectureTab({ arch }: { arch: Analysis['architecture'] }) {
  if (!arch) return <p style={{ color: 'var(--muted)' }}>No data.</p>;
  return (
    <div className="stagger">
      <div className="card">
        <h3 className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>Overview</h3>
        <p style={{ fontSize: '14px', lineHeight: 1.7 }}>{arch.summary}</p>
      </div>

      {arch.key_modules?.length > 0 && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>Key modules</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            {arch.key_modules.map((m) => (
              <code key={m} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px', fontSize: '12px' }}>
                {m}
              </code>
            ))}
          </div>
        </div>
      )}

      {Object.keys(arch.ownership ?? {}).length > 0 && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>Ownership</h3>
          {Object.entries(arch.ownership).map(([module, owners]) => (
            <div key={module} style={{ marginBottom: '10px' }}>
              <code style={{ fontSize: '12px', color: 'var(--sea)' }}>{module}</code>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginTop: '4px' }}>
                {owners.map((ownerUrl) => {
                  const login = ownerUrl.replace('https://github.com/', '');
                  return (
                    <a key={ownerUrl} href={ownerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px' }}>
                      @{login}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthTab({ health }: { health: Analysis['health'] }) {
  if (!health) return <p style={{ color: 'var(--muted)' }}>No data.</p>;
  const trendTone = { growing: 'var(--ok)', stable: 'var(--sea)', declining: 'var(--danger)', unknown: 'var(--muted)' }[health.trend] ?? 'var(--muted)';
  return (
    <div className="stagger">
      <div className="card">
        <p style={{ fontSize: '14px', lineHeight: 1.7 }}>{health.summary}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-3)' }}>
        <Metric label="Activity" value={health.activity} />
        <Metric label="PR merge speed" value={health.pr_merge_speed} />
        <Metric label="Contributor concentration" value={health.contributor_concentration} />
        <Metric label="Trend" value={health.trend} valueStyle={{ color: trendTone, fontWeight: 600, fontFamily: 'var(--font-mono)' }} />
      </div>
    </div>
  );
}

function StartHereTab({ points }: { points: StartingPoint[] }) {
  if (!points?.length) return <p style={{ color: 'var(--muted)' }}>No suggestions.</p>;
  return (
    <div className="stagger">
      {points.map((p, i) => (
        <div key={i} className="card card-hover">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--beacon)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, minWidth: '22px' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <a href={p.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: '14px' }}>
              {p.name}
            </a>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: '0 0 0 32px' }}>{p.reason}</p>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, valueStyle }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="eyebrow" style={{ marginBottom: '4px', fontSize: '10px' }}>{label}</div>
      <div style={{ fontSize: '14px', ...valueStyle }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: RepoReport['status'] }) {
  const tones: Record<RepoReport['status'], string> = {
    pending: 'var(--muted)', fetching: 'var(--warn)', analyzing: 'var(--sea)', done: 'var(--ok)', error: 'var(--danger)',
  };
  return (
    <span style={{ color: tones[status], fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
      {status}
    </span>
  );
}
