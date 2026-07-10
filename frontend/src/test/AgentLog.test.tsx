import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentLog } from '../components/AgentLog';
import type { AgentEvent } from '../types';

describe('AgentLog', () => {
  it('renders nothing when events is empty', () => {
    const { container } = render(<AgentLog events={[]} repoId={null} onCancel={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows console header with repo and model when events present', () => {
    const events: AgentEvent[] = [{ type: 'started', owner: 'foo', repo: 'bar', model: 'gpt-4o-mini' }];
    render(<AgentLog events={events} repoId={1} onCancel={() => {}} />);
    expect(screen.getAllByText('foo/bar').length).toBeGreaterThan(0);
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
  });

  it('renders started event with owner/repo', () => {
    const events: AgentEvent[] = [{ type: 'started', owner: 'facebook', repo: 'react', model: 'gpt-4o-mini' }];
    render(<AgentLog events={events} repoId={1} onCancel={() => {}} />);
    expect(screen.getAllByText(/facebook\/react/).length).toBeGreaterThan(0);
  });

  it('renders tool_call event', () => {
    const events: AgentEvent[] = [
      { type: 'started', owner: 'foo', repo: 'bar', model: 'gpt-4o-mini' },
      { type: 'tool_call', name: 'list_issues', args: { limit: 30 } },
    ];
    render(<AgentLog events={events} repoId={1} onCancel={() => {}} />);
    expect(screen.getByText(/list_issues/)).toBeInTheDocument();
  });

  it('renders tool_result event', () => {
    const events: AgentEvent[] = [
      { type: 'started', owner: 'foo', repo: 'bar', model: 'gpt-4o-mini' },
      { type: 'tool_result', name: 'list_issues', success: true, summary: '25 open issues' },
    ];
    render(<AgentLog events={events} repoId={1} onCancel={() => {}} />);
    expect(screen.getByText(/25 open issues/)).toBeInTheDocument();
  });

  it('renders done event', () => {
    const events: AgentEvent[] = [
      { type: 'started', owner: 'foo', repo: 'bar', model: 'gpt-4o-mini' },
      { type: 'done', iterations: 5, totalTokens: 12000 },
    ];
    render(<AgentLog events={events} repoId={null} onCancel={() => {}} />);
    expect(screen.getByText(/done/)).toBeInTheDocument();
    expect(screen.getByText(/5 iterations/)).toBeInTheDocument();
  });

  it('renders error event', () => {
    const events: AgentEvent[] = [
      { type: 'error', message: 'Something went wrong' },
    ];
    render(<AgentLog events={events} repoId={null} onCancel={() => {}} />);
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
  });

  it('shows Stop button while running', () => {
    const events: AgentEvent[] = [{ type: 'started', owner: 'foo', repo: 'bar', model: 'gpt-4o-mini' }];
    render(<AgentLog events={events} repoId={1} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('hides Stop button when finished', () => {
    const events: AgentEvent[] = [
      { type: 'started', owner: 'foo', repo: 'bar', model: 'gpt-4o-mini' },
      { type: 'done', iterations: 3, totalTokens: 5000 },
    ];
    render(<AgentLog events={events} repoId={null} onCancel={() => {}} />);
    expect(screen.queryByRole('button', { name: /stop/i })).toBeNull();
  });

  it('calls onCancel when Stop is clicked', () => {
    const onCancel = vi.fn();
    const events: AgentEvent[] = [{ type: 'started', owner: 'foo', repo: 'bar', model: 'gpt-4o-mini' }];
    render(<AgentLog events={events} repoId={1} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
