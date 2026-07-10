import { useRef, useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { SearchBar } from './components/SearchBar';
import { ReportTabs } from './components/ReportTabs';
import { AgentLog } from './components/AgentLog';
import { ChatPanel } from './components/ChatPanel';
import { Nav } from './components/Nav';
import { ToastProvider, useToast, Skeleton } from './components/ui';
import { useAgentStream } from './hooks/useAgentStream';
import { analyzeRepo, getReport, cancelAnalysis } from './api';
import { FeedPage } from './pages/FeedPage';
import type { RepoReport } from './types';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/r/:id" element={<RepoDetailPage />} />
      </Routes>
    </ToastProvider>
  );
}

function AnalyzePage() {
  const [report, setReport] = useState<RepoReport | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

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
        if (data.status === 'done' || data.status === 'error') {
          stopPolling();
          setLoading(false);
          if (data.status === 'done') toast('ok', 'Analysis complete');
        }
      } catch { stopPolling(); setError('Failed to fetch report'); setLoading(false); }
    }, 3000);
  }

  useEffect(() => stopPolling, []);

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
        toast('info', 'Analyzed recently — showing cached report');
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
    toast('info', 'Analysis stopped');
  }

  const isDone = agentEvents.some((e) => e.type === 'done');
  const showHero = !report && !agentEvents.length;

  return (
    <div className="page-shell">
      <Nav />
      <main className="page-main">
        {showHero && (
          <header className="hero">
            <div className="hero-beam" aria-hidden="true" />
            <h1>
              Understand any GitHub repo<br />
              before you write a <span className="accent-word">line of code</span>.
            </h1>
            <p>
              Paste a repo URL. Beacon's agent reads the issues, PRs, and code —
              then shows you exactly where to land your first contribution.
            </p>
          </header>
        )}

        <SearchBar onSubmit={handleAnalyze} loading={loading} />

        {error && <div className="error-banner">{error}</div>}

        {loading && !agentEvents.length && (
          <p style={{ marginTop: 'var(--sp-5)', color: 'var(--muted)', textAlign: 'center' }}>
            Connecting to agent…
          </p>
        )}

        <AgentLog events={agentEvents} repoId={repoId} onCancel={handleCancel} />

        {isDone && report?.analysis && (
          <>
            <ReportTabs report={report} />
            {repoId && <ChatPanel repoId={repoId} />}
          </>
        )}

        {!isDone && report && report.status !== 'done' && (
          <p style={{ marginTop: 'var(--sp-4)', color: 'var(--muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
            Status: <strong style={{ color: 'var(--text)' }}>{report.status}</strong>
          </p>
        )}
      </main>

      <footer className="footer">
        <span>Beacon — OSS navigator</span>
        <span>powered by OpenRouter</span>
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

  const repoId = id ? parseInt(id, 10) : null;

  return (
    <div className="page-shell">
      <Nav />
      <main className="page-main">
        <button className="back-link" onClick={() => navigate('/')}>← back to feed</button>

        {loading && (
          <div>
            <Skeleton width={260} height={20} />
            <Skeleton width="100%" height={120} style={{ marginTop: 16 }} />
          </div>
        )}
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        {report && (
          <div className="fade-in">
            <ReportTabs report={report} />
            {repoId !== null && report.analysis && <ChatPanel repoId={repoId} />}
          </div>
        )}
      </main>
    </div>
  );
}
