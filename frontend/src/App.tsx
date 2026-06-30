import { useRef, useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { SearchBar } from './components/SearchBar';
import { ReportTabs } from './components/ReportTabs';
import { AgentLog } from './components/AgentLog';
import { useAgentStream } from './hooks/useAgentStream';
import { analyzeRepo, getReport, cancelAnalysis } from './api';
import { FeedPage } from './pages/FeedPage';
import type { RepoReport } from './types';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FeedPage />} />
      <Route path="/analyze" element={<AnalyzePage />} />
      <Route path="/r/:id" element={<RepoDetailPage />} />
    </Routes>
  );
}

function Nav() {
  const navigate = useNavigate();
  return (
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
        <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.3px' }}>Beacon</span>
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
          background: '#5b8ef015', color: 'var(--accent)', border: '1px solid #5b8ef030',
          letterSpacing: '0.05em',
        }}>BETA</span>
      </div>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
        Navigate open source like you've been there before.
      </span>
    </nav>
  );
}

function AnalyzePage() {
  const [report, setReport] = useState<RepoReport | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const agentEvents = useAgentStream(repoId);

  function stopPolling() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function startPolling(id: number) {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const data = await getReport(id);
        setReport(data);
        if (data.status === 'done' || data.status === 'error') { stopPolling(); setLoading(false); }
      } catch { stopPolling(); setError('Failed to fetch report'); setLoading(false); }
    }, 3000);
  }

  async function handleAnalyze(url: string) {
    stopPolling();
    setLoading(true);
    setError(null);
    setReport(null);
    setRepoId(null);

    try {
      const { id, cached } = await analyzeRepo(url) as { id: number; status: string; cached?: boolean };
      setRepoId(id);
      if (cached) {
        navigate(`/r/${id}`);
        return;
      }
      startPolling(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!repoId) return;
    await cancelAnalysis(repoId).catch(() => {});
    stopPolling(); setLoading(false); setRepoId(null);
  }

  const isDone = agentEvents.some((e) => e.type === 'done');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      <main style={{ flex: 1, maxWidth: '900px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        {!report && !agentEvents.length && (
          <div style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '32px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '12px' }}>
              Understand any GitHub repo<br />before you write a line of code.
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '480px', margin: '0 auto' }}>
              Paste a repo URL. Beacon's AI agent explores it and surfaces ranked issues,
              architecture, health, and where to start — in seconds.
            </p>
          </div>
        )}

        <SearchBar onSubmit={handleAnalyze} loading={loading} />

        {error && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f8717110', border: '1px solid #f8717130', borderRadius: '8px', color: 'var(--error)', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading && !agentEvents.length && (
          <p style={{ marginTop: '24px', color: 'var(--muted)', textAlign: 'center' }}>Connecting to agent…</p>
        )}

        <AgentLog events={agentEvents} repoId={repoId} onCancel={handleCancel} />

        {isDone && report?.analysis && <ReportTabs report={report} />}

        {!isDone && report && report.status !== 'done' && (
          <p style={{ marginTop: '16px', color: 'var(--muted)', fontSize: '13px', textAlign: 'center' }}>
            Status: <strong style={{ color: 'var(--text)' }}>{report.status}</strong>
          </p>
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--border-soft)', padding: '16px 32px', fontSize: '12px', color: 'var(--muted-2)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Beacon — OSS navigator</span>
        <span>Powered by OpenRouter</span>
      </footer>
    </div>
  );
}

function RepoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<RepoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReport(parseInt(id, 10))
      .then(setReport)
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav />
      <main style={{ flex: 1, maxWidth: '900px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', marginBottom: '24px', padding: 0 }}
        >
          ← Back to feed
        </button>

        {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
        {report && <ReportTabs report={report} />}
      </main>
    </div>
  );
}
