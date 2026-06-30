import { useEffect, useState } from 'react';
import { getIssueResearch, runIssueResearch } from '../api';
import type { IssueResearch } from '../types';
import type { RankedIssue } from '../analysisTypes';

interface Props {
  repoId: number;
  issue: RankedIssue;
  repoName: string;
  onClose: () => void;
}

export function IssueResearchDrawer({ repoId, issue, repoName, onClose }: Props) {
  const [research, setResearch] = useState<IssueResearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    // Try to load cached research
    setLoading(true);
    getIssueResearch(repoId, issue.number)
      .then((r) => { setResearch(r.research); setCached(r.cached); })
      .catch((e) => { if ((e as Error).message !== 'not_found') setError((e as Error).message); })
      .finally(() => setLoading(false));
  }, [repoId, issue.number]);

  async function handleResearch() {
    setLoading(true);
    setError(null);
    try {
      const r = await runIssueResearch(repoId, issue.number);
      setResearch(r.research);
      setCached(r.cached);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 40 }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '480px',
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 50, overflowY: 'auto', padding: '24px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{repoName}</p>
            <a
              href={issue.github_url}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text)', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
            >
              #{issue.number} {issue.title}
            </a>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        {/* No research yet */}
        {!research && !loading && !error && (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <p style={{ color: 'var(--muted)', marginBottom: '16px', fontSize: '14px' }}>
              No deep research yet for this issue.
            </p>
            <button onClick={handleResearch} style={primaryBtn}>
              Run Deep Research
            </button>
          </div>
        )}

        {loading && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: '40px' }}>
            {research ? 'Refreshing…' : 'Agent is researching this issue…'}
          </p>
        )}

        {error && (
          <div style={{ padding: '12px', background: '#f8717110', borderRadius: '8px', color: 'var(--error)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {research && !loading && (
          <>
            {cached && (
              <p style={{ fontSize: '11px', color: 'var(--muted-2)', marginBottom: '16px' }}>Cached result</p>
            )}

            <Section title="What is this issue?">
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--muted)' }}>{research.summary}</p>
            </Section>

            <Section title="How to fix it">
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--muted)', whiteSpace: 'pre-line' }}>{research.approach}</p>
            </Section>

            <Section title="Files to change">
              {research.files_to_change.length === 0
                ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>None identified</p>
                : research.files_to_change.map((f) => (
                  <div key={f.path} style={{ marginBottom: '10px' }}>
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'monospace' }}>
                      {f.path}
                    </a>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>{f.reason}</p>
                  </div>
                ))
              }
            </Section>

            <Section title="Similar merged PRs">
              {research.similar_prs.length === 0
                ? <p style={{ color: 'var(--muted)', fontSize: '13px' }}>None found</p>
                : research.similar_prs.map((pr) => (
                  <a key={pr.number} href={pr.url} target="_blank" rel="noreferrer"
                    style={{ display: 'block', fontSize: '13px', color: 'var(--accent)', marginBottom: '6px', textDecoration: 'none' }}>
                    #{pr.number} {pr.title}
                  </a>
                ))
              }
            </Section>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <InfoPill label="Effort" value={research.effort_estimate} />
              <InfoPill
                label="Reviewer"
                value={`@${research.reviewer_to_ping.replace('https://github.com/', '')}`}
                href={research.reviewer_to_ping}
              />
            </div>

            <button onClick={handleResearch} style={{ ...primaryBtn, fontSize: '12px', padding: '8px 14px' }}>
              Re-run research
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: '8px' }}>
        {title.toUpperCase()}
      </p>
      {children}
    </div>
  );
}

function InfoPill({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <p style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '2px' }}>{label.toUpperCase()}</p>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>{value}</a>
      ) : (
        <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0 }}>{value}</p>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px', borderRadius: '8px', background: 'var(--accent)',
  color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
};
