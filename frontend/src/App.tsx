import { useRef, useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { ReportTabs } from './components/ReportTabs';
import { AgentLog } from './components/AgentLog';
import { useAgentStream } from './hooks/useAgentStream';
import { analyzeRepo, getReport, cancelAnalysis } from './api';
import type { RepoReport } from './types';

export default function App() {
  const [report, setReport] = useState<RepoReport | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const agentEvents = useAgentStream(repoId);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startPolling(id: number) {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const data = await getReport(id);
        setReport(data);
        if (data.status === 'done' || data.status === 'error') {
          stopPolling();
          setLoading(false);
        }
      } catch {
        stopPolling();
        setError('Failed to fetch report');
        setLoading(false);
      }
    }, 3000);
  }

  async function handleAnalyze(url: string) {
    stopPolling();
    setLoading(true);
    setError(null);
    setReport(null);
    setRepoId(null);

    try {
      const { id } = await analyzeRepo(url);
      setRepoId(id);
      startPolling(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!repoId) return;
    await cancelAnalysis(repoId).catch(() => {});
    stopPolling();
    setLoading(false);
    setRepoId(null);
  }

  const isDone = agentEvents.some((e) => e.type === 'done');

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 24px' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '6px' }}>Beacon</h1>
        <p style={{ color: 'var(--muted)' }}>Navigate open source like you've been there before.</p>
      </header>

      <SearchBar onSubmit={handleAnalyze} loading={loading} />

      {error && (
        <p style={{ marginTop: '16px', color: 'var(--error)' }}>{error}</p>
      )}

      {loading && !agentEvents.length && (
        <p style={{ marginTop: '24px', color: 'var(--muted)' }}>Connecting to agent…</p>
      )}

      <AgentLog events={agentEvents} repoId={repoId} onCancel={handleCancel} />

      {isDone && report?.analysis && (
        <ReportTabs report={report} />
      )}

      {!isDone && report && report.status !== 'done' && (
        <p style={{ marginTop: '16px', color: 'var(--muted)', fontSize: '13px' }}>
          Status: <strong style={{ color: 'var(--text)' }}>{report.status}</strong>
        </p>
      )}
    </div>
  );
}
