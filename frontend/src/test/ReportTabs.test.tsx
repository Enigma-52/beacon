import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportTabs } from '../components/ReportTabs';
import type { RepoReport } from '../types';

const baseReport: RepoReport = {
  id: 1,
  url: 'https://github.com/foo/bar',
  status: 'pending',
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

  it('shows pending message when status is not done', () => {
    render(<ReportTabs report={baseReport} />);
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });

  it('shows no data message when done but no analysis', () => {
    render(<ReportTabs report={{ ...baseReport, status: 'done', analysis: null }} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    render(<ReportTabs report={baseReport} />);
    fireEvent.click(screen.getByText('Architecture'));
    expect(screen.getByText('Architecture').style.color).toBeTruthy();
  });
});
