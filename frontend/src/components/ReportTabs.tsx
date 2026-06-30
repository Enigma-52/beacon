import { useState } from 'react';
import type { RepoReport } from '../types';

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

  const content = report.analysis?.[active];
  const isPending = report.status !== 'done';

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ marginBottom: '12px', color: 'var(--muted)', fontSize: '13px' }}>
        {report.url} — <StatusBadge status={report.status} />
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
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '120px' }}>
        {isPending ? (
          <p style={{ color: 'var(--muted)' }}>Analysis in progress…</p>
        ) : content ? (
          <pre style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '16px',
            overflow: 'auto',
            fontSize: '13px',
            whiteSpace: 'pre-wrap',
          }}>
            {JSON.stringify(content, null, 2)}
          </pre>
        ) : (
          <p style={{ color: 'var(--muted)' }}>No data for this section yet.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RepoReport['status'] }) {
  const colors: Record<RepoReport['status'], string> = {
    pending: '#888',
    fetching: '#f59e0b',
    analyzing: '#3b82f6',
    done: '#22c55e',
    error: '#ef4444',
  };
  return (
    <span style={{ color: colors[status], fontWeight: 600 }}>{status}</span>
  );
}
