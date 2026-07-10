import { useState } from 'react';
import type { RepoReport } from '../types';
import type { Analysis, RankedIssue, StartingPoint } from '../analysisTypes';
import { ScoreRing, DifficultyChip, SignalChip } from './ui';
import { IssueResearchDrawer } from './IssueResearchDrawer';

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
  const [researchIssue, setResearchIssue] = useState<RankedIssue | null>(null);
  const analysis = report.analysis as Analysis | null;
  const meta = report.meta;
  const repoName = report.url.replace('https://github.com/', '');

  return (
    <div style={{ marginTop: 'var(--sp-6)' }}>
      <header className="report-header">
        <div>
          <a href={report.url} target="_blank" rel="noreferrer" className="report-title">
            {repoName}
          </a>
          <div className="report-meta-row">
            <StatusBadge status={report.status} />
            {meta?.model && <span className="chip chip-muted">{meta.model}</span>}
            {meta?.total_tokens != null && (
              <span className="chip chip-muted" title={`${meta.iterations ?? '?'} iterations`}>
                {meta.total_tokens.toLocaleString()} tokens
              </span>
            )}
            {meta?.duration_ms != null && (
              <span className="chip chip-muted">{Math.round(meta.duration_ms / 1000)}s run</span>
            )}
          </div>
        </div>
      </header>

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
          <IssuesTab issues={analysis.issues} onResearch={setResearchIssue} />
        ) : active === 'architecture' ? (
          <ArchitectureTab arch={analysis.architecture} />
        ) : active === 'health' ? (
          <HealthTab health={analysis.health} />
        ) : (
          <StartHereTab points={analysis.starting_points} />
        )}
      </div>

      {researchIssue && (
        <IssueResearchDrawer
          repoId={report.id}
          issue={researchIssue}
          repoName={repoName}
          onClose={() => setResearchIssue(null)}
        />
      )}
    </div>
  );
}

function IssuesTab({ issues, onResearch }: { issues: RankedIssue[]; onResearch: (i: RankedIssue) => void }) {
  if (!issues?.length) return <p style={{ color: 'var(--muted)' }}>No issues found.</p>;
  const sorted = [...issues].sort((a, b) => b.score - a.score);
  const avg = (issues.reduce((s, i) => s + i.score, 0) / issues.length).toFixed(1);
  const counts = { beginner: 0, intermediate: 0, advanced: 0 } as Record<string, number>;
  for (const i of issues) counts[i.difficulty] = (counts[i.difficulty] ?? 0) + 1;

  return (
    <>
      <div className="tab-summary">
        <span><strong>{issues.length}</strong> ranked picks</span>
        <span><strong>{avg}</strong> avg score</span>
        {counts.beginner > 0 && <span><strong>{counts.beginner}</strong> beginner</span>}
        {counts.intermediate > 0 && <span><strong>{counts.intermediate}</strong> intermediate</span>}
        {counts.advanced > 0 && <span><strong>{counts.advanced}</strong> advanced</span>}
      </div>

      <div className="stagger">
        {sorted.map((issue) => (
          <div key={issue.number} className="card card-hover issue-card">
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
            <button className="btn btn-ghost issue-dive" onClick={() => onResearch(issue)}>
              Deep dive →
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function ArchitectureTab({ arch }: { arch: Analysis['architecture'] }) {
  if (!arch) return <p style={{ color: 'var(--muted)' }}>No data.</p>;
  const ownership = Object.entries(arch.ownership ?? {});
  return (
    <div className="stagger">
      <div className="card">
        <h3 className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>Overview</h3>
        <p style={{ fontSize: '14px', lineHeight: 1.75 }}>{arch.summary}</p>
      </div>

      {arch.key_modules?.length > 0 && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>Key modules</h3>
          <div className="module-grid">
            {arch.key_modules.map((m) => (
              <code key={m} className="module-cell">{m}</code>
            ))}
          </div>
        </div>
      )}

      {ownership.length > 0 && (
        <div className="card">
          <h3 className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>Who owns what</h3>
          <div className="ownership-table">
            {ownership.map(([module, owners]) => (
              <div key={module} className="ownership-row">
                <code style={{ fontSize: '12px', color: 'var(--sea)' }}>{module}</code>
                <span className="ownership-owners">
                  {owners.map((ownerUrl) => {
                    const login = ownerUrl.replace('https://github.com/', '');
                    return (
                      <a key={ownerUrl} href={ownerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px' }}>
                        @{login}
                      </a>
                    );
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TREND_GLYPH: Record<string, { glyph: string; tone: string }> = {
  growing: { glyph: '↗', tone: 'var(--ok)' },
  stable: { glyph: '→', tone: 'var(--sea)' },
  declining: { glyph: '↘', tone: 'var(--danger)' },
  unknown: { glyph: '—', tone: 'var(--muted)' },
};

function HealthTab({ health }: { health: Analysis['health'] }) {
  if (!health) return <p style={{ color: 'var(--muted)' }}>No data.</p>;
  const trend = TREND_GLYPH[health.trend] ?? TREND_GLYPH.unknown;
  return (
    <div className="stagger">
      <div className="card health-lead">
        <span className="health-trend" style={{ color: trend.tone }}>{trend.glyph}</span>
        <p style={{ fontSize: '14px', lineHeight: 1.75, margin: 0 }}>{health.summary}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--sp-3)' }}>
        <Metric label="Activity" value={health.activity} />
        <Metric label="PR merge speed" value={health.pr_merge_speed} />
        <Metric label="Contributor concentration" value={health.contributor_concentration} />
        <Metric
          label="Trend"
          value={`${trend.glyph} ${health.trend}`}
          valueStyle={{ color: trend.tone, fontWeight: 600, fontFamily: 'var(--font-mono)' }}
        />
      </div>
    </div>
  );
}

function StartHereTab({ points }: { points: StartingPoint[] }) {
  if (!points?.length) return <p style={{ color: 'var(--muted)' }}>No suggestions.</p>;
  return (
    <div className="route stagger">
      {points.map((p, i) => (
        <div key={i} className="route-stop">
          <span className="route-marker">{String(i + 1).padStart(2, '0')}</span>
          <div className="route-card card card-hover">
            <a href={p.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: '14px' }}>
              {p.name}
            </a>
            <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: '4px 0 0' }}>{p.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, valueStyle }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div className="card metric-card" style={{ marginTop: 0 }}>
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
