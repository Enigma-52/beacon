import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportTabs } from '../components/ReportTabs';
import type { RepoReport } from '../types';

const baseReport: RepoReport = {
  id: 1,
  url: 'https://github.com/foo/bar',
  status: 'done',
  github_data: null,
  analysis: null,
  created_at: new Date().toISOString(),
};

describe('ReportTabs', () => {
  it('renders all four tabs', () => {
    render(<ReportTabs report={baseReport} />);
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Start Here')).toBeInTheDocument();
  });

  it('shows no data when analysis is null', () => {
    render(<ReportTabs report={baseReport} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('shows no issues message when issues array is empty', () => {
    render(<ReportTabs report={{
      ...baseReport,
      analysis: { issues: [], architecture: undefined, health: undefined, starting_points: undefined },
    }} />);
    expect(screen.getByText(/no issues/i)).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    render(<ReportTabs report={baseReport} />);
    fireEvent.click(screen.getByText('Architecture'));
    expect(screen.getByText('Architecture')).toBeInTheDocument();
  });

  it('links repo url in header', () => {
    render(<ReportTabs report={baseReport} />);
    expect(screen.getByRole('link', { name: /foo\/bar/i })).toHaveAttribute('href', 'https://github.com/foo/bar');
  });
});
