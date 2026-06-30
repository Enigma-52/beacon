import { useEffect, useRef } from 'react';
import type { AgentEvent } from '../types';

const TOOL_ICONS: Record<string, string> = {
  get_repo_info: '📦',
  list_issues: '🐛',
  list_merged_prs: '🔀',
  get_pr_details: '🔍',
  list_contributors: '👥',
  get_file_tree: '🌲',
  get_file_content: '📄',
  get_readme: '📖',
  produce_analysis: '✅',
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
    <div style={{
      marginTop: '24px',
      background: '#0a0a0a',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          AGENT LOG
        </span>
        {isRunning && (
          <button
            onClick={onCancel}
            style={{
              padding: '3px 10px',
              background: 'transparent',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              color: '#ef4444',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Stop
          </button>
        )}
      </div>

      <div style={{
        maxHeight: '320px',
        overflowY: 'auto',
        padding: '12px 14px',
        fontFamily: 'monospace',
        fontSize: '13px',
        lineHeight: '1.8',
      }}>
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
        <div style={{ color: '#4ade80' }}>
          {'◆ analyzing '}<span style={{ color: '#e8e8e8' }}>{event.owner}/{event.repo}</span>
          <span style={{ color: '#888', fontSize: '11px' }}> via {event.model}</span>
        </div>
      );

    case 'iteration':
      return (
        <div style={{ color: '#555', fontSize: '11px' }}>
          {'  iteration '}{event.iteration} ({event.messageCount} messages)
        </div>
      );

    case 'tool_call':
      if (event.name === 'produce_analysis') {
        return (
          <div style={{ color: '#a78bfa' }}>
            {'→ '}<span style={{ color: '#c4b5fd' }}>produce_analysis</span>
            <span style={{ color: '#555' }}> — finalizing</span>
          </div>
        );
      }
      return (
        <div style={{ color: '#60a5fa' }}>
          {'→ '}{TOOL_ICONS[event.name] ?? '⚙'}{' '}
          <span style={{ color: '#93c5fd' }}>{event.name}</span>
          {Object.keys(event.args).length > 0 && (
            <span style={{ color: '#555' }}>{' '}({formatArgs(event.args)})</span>
          )}
        </div>
      );

    case 'tool_result':
      return (
        <div style={{ color: event.success ? '#86efac' : '#fca5a5', paddingLeft: '16px' }}>
          {'← '}{event.summary}
        </div>
      );

    case 'done':
      return (
        <div style={{ color: '#4ade80', marginTop: '4px' }}>
          {'✓ done — '}{event.iterations} iterations, {event.totalTokens.toLocaleString()} tokens
        </div>
      );

    case 'error':
      return (
        <div style={{ color: '#f87171' }}>
          {'✗ '}{event.message}
        </div>
      );
  }
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}
