import { useRef, useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { SearchBar } from './components/SearchBar';
import { ReportTabs } from './components/ReportTabs';
import { AgentLog } from './components/AgentLog';
import { ChatPanel } from './components/ChatPanel';
import { CommandPalette } from './components/CommandPalette';
import { Nav } from './components/Nav';
import { ToastProvider, useToast, Skeleton } from './components/ui';
import { useAgentStream } from './hooks/useAgentStream';
import { analyzeRepo, getReport, cancelAnalysis } from './api';
import { downloadMarkdown } from './lib/exportReport';
import { FeedPage } from './pages/FeedPage';
import { MatchPage } from './pages/MatchPage';
import type { RepoReport } from './types';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <CommandPalette />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/match" element={<MatchPage />} />
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
  const [params] = useSearchParams();
  const autoStarted = useRef(false);

  const agentEvents = useAgentStream(repoId);

  // /analyze?url=…&force=1 starts immediately (used by the re-analyze button)
  useEffect(() => {
    const url = params.get('url');
    if (url && !autoStarted.current) {
      autoStarted.current = true;
      void handleAnalyze(url, params.get('force') === '1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

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

  async function handleAnalyze(url: string, force = false) {
    stopPolling();
    setLoading(true);
    setError(null);
    setReport(null);
    setRepoId(null);

    try {
      const { id, cached } = await analyzeRepo(url, force) as { id: number; status: string; cached?: boolean };
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
  const toast = useToast();
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

  function share() {
    navigator.clipboard.writeText(window.location.href)
      .then(() => toast('ok', 'Link copied'))
      .catch(() => toast('error', 'Copy failed'));
  }

  return (
    <div className="page-shell">
      <Nav
        right={
          report ? (
            <span style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className="btn btn-ghost" onClick={share}>Share</button>
              <button className="btn btn-ghost" onClick={() => downloadMarkdown(report)}>Export .md</button>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/analyze?url=${encodeURIComponent(report.url)}&force=1`)}
              >
                Re-analyze
              </button>
            </span>
          ) : undefined
        }
      />
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
