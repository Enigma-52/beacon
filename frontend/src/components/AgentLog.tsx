import { useEffect, useRef, useState } from 'react';
import type { AgentEvent } from '../types';

const TOOL_GLYPHS: Record<string, string> = {
  get_repo_info: 'meta',
  list_issues: 'issues',
  list_merged_prs: 'prs',
  get_pr_details: 'pr',
  list_contributors: 'people',
  get_file_tree: 'tree',
  get_file_content: 'file',
  get_readme: 'readme',
};

/** Exploration phases, in the order the agent typically works. */
const PHASES = ['survey', 'issues', 'prs', 'people', 'code', 'synthesis'] as const;
type Phase = (typeof PHASES)[number];

const TOOL_PHASE: Record<string, Phase> = {
  get_repo_info: 'survey',
  list_issues: 'issues',
  list_merged_prs: 'prs',
  get_pr_details: 'prs',
  list_contributors: 'people',
  get_file_tree: 'code',
  get_file_content: 'code',
  get_readme: 'code',
  produce_analysis: 'synthesis',
};

interface Props {
  events: AgentEvent[];
  repoId: number | null;
  onCancel: () => void;
}

export function AgentLog({ events, repoId, onCancel }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  const isFinished = events.some((e) => e.type === 'done' || e.type === 'error');
  const isRunning = repoId !== null && !isFinished && events.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  useEffect(() => {
    if (!isRunning) return;
    if (startRef.current === null) startRef.current = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current!) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  if (events.length === 0) return null;

  const started = events.find((e) => e.type === 'started');
  const done = events.find((e) => e.type === 'done');
  const reached = new Set<Phase>();
  let current: Phase | null = null;
  for (const e of events) {
    if (e.type === 'tool_call' && TOOL_PHASE[e.name]) {
      current = TOOL_PHASE[e.name];
      reached.add(current);
    }
  }

  return (
    <div className="agent-console rise-in">
      <div className="agent-console-header">
        <div className="agent-console-title">
          <span className={`console-light${isRunning ? ' live' : ''}`} aria-hidden="true" />
          {started?.type === 'started' && (
            <span className="console-repo">{started.owner}/{started.repo}</span>
          )}
          {started?.type === 'started' && <span className="chip chip-muted">{started.model}</span>}
        </div>
        <div className="agent-console-meta">
          {isRunning && <span className="console-clock">{formatElapsed(elapsed)}</span>}
          {done?.type === 'done' && (
            <>
              <span className="chip chip-muted">{done.iterations} steps</span>
              <span className="chip chip-muted">{done.totalTokens.toLocaleString()} tokens</span>
            </>
          )}
          {isRunning && (
            <button className="btn btn-danger-ghost" onClick={onCancel}>Stop</button>
          )}
        </div>
      </div>

      <div className="phase-track" aria-label="Exploration phases">
        {PHASES.map((p) => (
          <span
            key={p}
            className={`phase${reached.has(p) ? ' reached' : ''}${current === p && isRunning ? ' current' : ''}`}
          >
            {p}
          </span>
        ))}
      </div>

      <div className="agent-log-body">
        {events.map((event, i) => (
          <LogLine key={i} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function LogLine({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case 'started':
      return (
        <div className="log-started">
          {'◆ analyzing '}<span style={{ color: 'var(--text)' }}>{event.owner}/{event.repo}</span>
        </div>
      );

    case 'iteration':
      return (
        <div className="log-iteration">
          {'  iteration '}{event.iteration} ({event.messageCount} messages)
        </div>
      );

    case 'tool_call':
      if (event.name === 'produce_analysis') {
        return (
          <div className="log-final">
            {'→ produce_analysis'}
            <span style={{ color: 'var(--muted-2)' }}> — synthesizing report</span>
          </div>
        );
      }
      return (
        <div className="log-tool">
          {'→ '}
          <span className="tool-kind">[{TOOL_GLYPHS[event.name] ?? 'tool'}]</span>{' '}
          <span className="tool-name">{event.name}</span>
          {Object.keys(event.args).length > 0 && (
            <span className="tool-args">{' '}({formatArgs(event.args)})</span>
          )}
        </div>
      );

    case 'tool_result':
      return (
        <div className={event.success ? 'log-result-ok' : 'log-result-err'}>
          {'← '}{event.summary}
        </div>
      );

    case 'done':
      return (
        <div className="log-done">
          {'✓ done — '}{event.iterations} iterations, {event.totalTokens.toLocaleString()} tokens
        </div>
      );

    case 'error':
      return <div className="log-error">{'✗ '}{event.message}</div>;

    default:
      return null;
  }
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}
