import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FeedPage } from '../pages/FeedPage';
import * as api from '../api';

vi.mock('../api', () => ({
  getFeed: vi.fn(),
  getStats: vi.fn(),
  analyzeRepo: vi.fn(),
  getReport: vi.fn(),
  cancelAnalysis: vi.fn(),
  getIssueResearch: vi.fn(),
  runIssueResearch: vi.fn(),
  cancelIssueResearch: vi.fn(),
  getMatches: vi.fn(),
}));

const mockFeed = {
  repos: [
    {
      id: 1,
      url: 'https://github.com/facebook/react',
      name: 'facebook/react',
      description: 'A JavaScript library for building UIs',
      language: 'JavaScript',
      stars: 220000,
      last_analyzed: new Date().toISOString(),
      top_issues: [
        {
          number: 123,
          title: 'Fix useEffect memory leak',
          score: 8,
          difficulty: 'intermediate' as const,
          github_url: 'https://github.com/facebook/react/issues/123',
          reason: 'Well-scoped',
          signals: { no_comments: true, no_related_prs: false, is_fresh: true },
        },
      ],
    },
    {
      id: 2,
      url: 'https://github.com/vercel/next.js',
      name: 'vercel/next.js',
      description: 'The React Framework',
      language: 'TypeScript',
      stars: 120000,
      last_analyzed: new Date().toISOString(),
      top_issues: [],
    },
  ],
  languages: ['JavaScript', 'TypeScript'],
};

function renderFeed() {
  return render(
    <MemoryRouter>
      <FeedPage />
    </MemoryRouter>
  );
}

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getFeed).mockResolvedValue(mockFeed);
    vi.mocked(api.getStats).mockResolvedValue({ repos: 2, reports: 2, issues_ranked: 5, research_runs: 1, total_tokens: 42000 });
    vi.mocked(api.getIssueResearch).mockRejectedValue(new Error('not_found'));
  });

  it('shows loading state initially', () => {
    renderFeed();
    expect(screen.getByText(/loading feed/i)).toBeInTheDocument();
  });

  it('renders repo names after loading', async () => {
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText('facebook/react')).toBeInTheDocument();
      expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    });
  });

  it('renders repo description', async () => {
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText(/JavaScript library for building UIs/)).toBeInTheDocument();
    });
  });

  it('renders language sidebar filters', async () => {
    renderFeed();
    await waitFor(() => {
      // Language buttons appear in the sidebar — get all and check at least one matches
      expect(screen.getAllByText(/^JavaScript/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/^TypeScript/)[0]).toBeInTheDocument();
    });
  });

  it('filters repos by language when sidebar clicked', async () => {
    renderFeed();
    await waitFor(() => screen.getAllByText(/^TypeScript/));

    // Click the TypeScript button in the sidebar (first occurrence = sidebar button)
    fireEvent.click(screen.getAllByText(/^TypeScript/)[0]);

    expect(screen.queryByText('facebook/react')).toBeNull();
    expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
  });

  it('renders issue inside repo card', async () => {
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText(/#123 Fix useEffect memory leak/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no repos', async () => {
    vi.mocked(api.getFeed).mockResolvedValue({ repos: [], languages: [] });
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText(/no repos analyzed yet/i)).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(api.getFeed).mockRejectedValue(new Error('network error'));
    renderFeed();
    await waitFor(() => {
      expect(screen.getByText(/failed to load feed/i)).toBeInTheDocument();
    });
  });
});
