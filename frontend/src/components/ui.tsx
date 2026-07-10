import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

// ─── Score ring ────────────────────────────────────────────────────────

export function ScoreRing({ score, size = 34 }: { score: number; size?: number }) {
  const color = score >= 8 ? 'var(--ok)' : score >= 5 ? 'var(--warn)' : 'var(--danger)';
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const filled = (score / 10) * c;

  return (
    <div className="score-ring" style={{ width: size, height: size }} title={`Approachability ${score}/10`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="num" style={{ color, fontSize: size * 0.36 }}>{score}</span>
    </div>
  );
}

// ─── Chips ─────────────────────────────────────────────────────────────

const DIFFICULTY_CLASS: Record<string, string> = {
  beginner: 'chip-ok',
  intermediate: 'chip-warn',
  advanced: 'chip-danger',
};

export function DifficultyChip({ difficulty }: { difficulty: string }) {
  return <span className={`chip ${DIFFICULTY_CLASS[difficulty] ?? 'chip-muted'}`}>{difficulty}</span>;
}

export function SignalChip({ label, tone, title }: { label: string; tone: 'ok' | 'sea' | 'warn'; title: string }) {
  return (
    <span className={`chip chip-${tone}`} title={title} style={{ cursor: 'help' }}>
      {label}
    </span>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────

export function Skeleton({ width, height = 16, style }: { width?: string | number; height?: string | number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: width ?? '100%', height, ...style }} />;
}

export function RepoCardSkeleton() {
  return (
    <div className="repo-card" style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
      <Skeleton width={180} height={18} />
      <Skeleton width="70%" height={13} style={{ marginTop: 10 }} />
      <Skeleton width="45%" height={11} style={{ marginTop: 10 }} />
    </div>
  );
}

// ─── Toasts ────────────────────────────────────────────────────────────

type ToastTone = 'ok' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

const ToastContext = createContext<(tone: ToastTone, text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: ToastTone, text: string) => {
    const id = nextToastId++;
    setToasts((prev) => [...prev.slice(-3), { id, tone, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Time helper ───────────────────────────────────────────────────────

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
