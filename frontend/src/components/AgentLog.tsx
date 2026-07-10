import { useEffect, useRef } from 'react';
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

interface Props {
  events: AgentEvent[];
  repoId: number | null;
  onCancel: () => void;
}

export function AgentLog({ events, repoId, onCancel }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  if (events.length === 0) return null;

  const isFinished = events.some((e) => e.type === 'done' || e.type === 'error');
  const isRunning = repoId !== null && !isFinished;

  return (
    <div className="agent-log rise-in">
      <div className="agent-log-header">
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <span className="eyebrow">AGENT LOG</span>
          {isRunning && <span className="scanning" aria-hidden="true" />}
        </span>
        {isRunning && (
          <button className="btn btn-danger-ghost" onClick={onCancel}>Stop</button>
        )}
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

function LogLine({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case 'started':
      return (
        <div className="log-started">
          {'◆ analyzing '}<span style={{ color: 'var(--text)' }}>{event.owner}/{event.repo}</span>
          <span style={{ color: 'var(--muted-2)', fontSize: 'var(--text-xs)' }}> via {event.model}</span>
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
            <span style={{ color: 'var(--muted-2)' }}> — finalizing</span>
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
