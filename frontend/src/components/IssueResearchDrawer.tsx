import { useEffect, useRef, useState } from 'react';
import { getIssueResearch, runIssueResearch } from '../api';
import type { IssueResearch, AgentEvent } from '../types';
import type { RankedIssue } from '../analysisTypes';

interface Props {
  repoId: number;
  issue: RankedIssue;
  repoName: string;
  onClose: () => void;
}

const TOOL_ICONS: Record<string, string> = {
  get_issue_full: '📋',
  search_similar_prs: '🔍',
  get_pr_changed_files: '📁',
  get_file_content: '📄',
  produce_issue_research: '✅',
};

export function IssueResearchDrawer({ repoId, issue, repoName, onClose }: Props) {
  const [research, setResearch] = useState<IssueResearch | null>(null);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps]);

  // Try loading cached result on mount
  useEffect(() => {
    getIssueResearch(repoId, issue.number)
      .then((r) => { setResearch(r.research); setCached(r.cached); })
      .catch(() => {}); // 404 = not cached, that's fine
  }, [repoId, issue.number]);

  function connectWs() {
    if (wsRef.current) wsRef.current.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?id=${repoId}`);
    wsRef.current = ws;

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as AgentEvent;

        if (event.type === 'research_started') {
          setSteps([event]);
        } else if (event.type === 'tool_call' || event.type === 'tool_result') {
          setSteps((prev) => [...prev, event]);
        } else if (event.type === 'research_done') {
          setSteps((prev) => [...prev, event]);
          setRunning(false);
          ws.close();
          // Fetch the stored result
          getIssueResearch(repoId, issue.number)
            .then((r) => { setResearch(r.research); setCached(false); })
            .catch(() => setError('Research finished but failed to load result'));
        } else if (event.type === 'research_error') {
          setSteps((prev) => [...prev, event]);
          setError(event.message);
          setRunning(false);
          ws.close();
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setRunning(false);
    };

    return ws;
  }

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  async function handleResearch() {
    setRunning(true);
    setError(null);
    setResearch(null);
    setSteps([]);

    connectWs();

    try {
      await runIssueResearch(repoId, issue.number);
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
      wsRef.current?.close();
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 40 }} />

      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: '500px',
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 50, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{repoName}</p>
            <a href={issue.github_url} target="_blank" rel="noreferrer"
              style={{ color: 'var(--text)', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}>
              #{issue.number} {issue.title}
            </a>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>
            ✕
          </button>
        </div>

        {/* Action button */}
        {!running && (
          <button onClick={handleResearch} style={primaryBtn}>
            {research ? 'Re-run deep research' : 'Run deep research'}
          </button>
        )}

        {/* Live step log */}
        {(running || steps.length > 0) && (
          <div style={{
            background: '#0a0a0c', border: '1px solid var(--border)', borderRadius: '8px',
            padding: '12px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '220px', overflowY: 'auto',
          }}>
            {steps.map((step, i) => <StepLine key={i} event={step} />)}
            {running && (
              <div style={{ color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                <span>researching…</span>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        )}

        {error && (
          <div style={{ padding: '12px', background: '#f8717110', borderRadius: '8px', color: 'var(--error)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Research result */}
        {research && !running && (
          <>
            {cached && <p style={{ fontSize: '11px', color: 'var(--muted-2)' }}>Cached result</p>}

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
                    <a href={f.url} target="_blank" rel="noreferrer"
                      style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'monospace' }}>
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

            <div style={{ display: 'flex', gap: '12px' }}>
              <InfoPill label="Effort" value={research.effort_estimate} />
              <InfoPill
                label="Reviewer"
                value={`@${research.reviewer_to_ping.replace('https://github.com/', '')}`}
                href={research.reviewer_to_ping}
              />
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

function StepLine({ event }: { event: AgentEvent }) {
  if (event.type === 'research_started') {
    return <div style={{ color: '#60a5fa', marginBottom: '4px' }}>→ starting research on issue #{event.issueNumber}</div>;
  }
  if (event.type === 'tool_call') {
    const icon = TOOL_ICONS[event.name] ?? '🔧';
    return <div style={{ color: 'var(--muted)', marginBottom: '2px' }}>{icon} {event.name}</div>;
  }
  if (event.type === 'tool_result') {
    const color = event.success ? '#4ade80' : '#f87171';
    return <div style={{ color, marginBottom: '4px', paddingLeft: '16px' }}>↳ {event.summary}</div>;
  }
  if (event.type === 'research_done') {
    return <div style={{ color: '#4ade80', marginTop: '4px', fontWeight: 700 }}>✓ research complete</div>;
  }
  if (event.type === 'research_error') {
    return <div style={{ color: '#f87171', marginTop: '4px' }}>✗ {event.message}</div>;
  }
  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
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
      {href
        ? <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>{value}</a>
        : <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0 }}>{value}</p>
      }
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px', borderRadius: '8px', background: 'var(--accent)',
  color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, width: '100%',
};
