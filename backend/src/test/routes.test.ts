import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Mock all DAO and service modules before importing routes
vi.mock('../services/db', () => ({ pool: { query: vi.fn() } }));
vi.mock('../services/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../services/event-bus', () => ({
  eventBus: { subscribe: vi.fn(), emit: vi.fn(), emitterFor: vi.fn(() => vi.fn()) },
}));
vi.mock('../services/cancellation', () => ({
  cancellation: { register: vi.fn(() => new AbortController().signal), cancel: vi.fn(() => true), cleanup: vi.fn() },
}));
vi.mock('../services/processor', () => ({ processRepo: vi.fn(() => Promise.resolve()) }));
vi.mock('../dao/repos', () => ({
  findRepoByUrl: vi.fn(),
  upsertRepo: vi.fn(),
  findRepoById: vi.fn(),
  findAllDoneRepos: vi.fn(),
  updateRepoStatus: vi.fn(),
  updateRepoGithubData: vi.fn(),
}));
vi.mock('../dao/reports', () => ({
  findReportByRepoId: vi.fn(),
  insertReport: vi.fn(),
  updateReport: vi.fn(),
}));
vi.mock('../dao/issue-research', () => ({
  findIssueResearch: vi.fn(),
  upsertIssueResearch: vi.fn(),
}));
vi.mock('../agents/issue-researcher.agent', () => ({
  runIssueResearcherAgent: vi.fn(),
}));

import { analyzeRouter } from '../routes/analyze';
import { feedRouter } from '../routes/feed';
import { researchRouter } from '../routes/research';
import * as reposDao from '../dao/repos';
import * as reportsDao from '../dao/reports';
import * as issueResearchDao from '../dao/issue-research';

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/', analyzeRouter);
  app.use('/', feedRouter);
  app.use('/', researchRouter);
  return app;
}

describe('POST /analyze', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for missing url', async () => {
    const res = await request(buildApp()).post('/analyze').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url is required/i);
  });

  it('returns 400 for non-github url', async () => {
    const res = await request(buildApp()).post('/analyze').send({ url: 'https://gitlab.com/foo/bar' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid github url/i);
  });

  it('returns cached result if repo is done and fresh', async () => {
    vi.mocked(reposDao.findRepoByUrl).mockResolvedValue({
      id: 1,
      url: 'https://github.com/foo/bar',
      status: 'done',
      github_data: null,
      created_at: new Date(),
      updated_at: new Date(), // just now = fresh
    });

    const res = await request(buildApp()).post('/analyze').send({ url: 'https://github.com/foo/bar' });
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.id).toBe(1);
  });

  it('upserts and starts analysis for new repo', async () => {
    vi.mocked(reposDao.findRepoByUrl).mockResolvedValue(null);
    vi.mocked(reposDao.upsertRepo).mockResolvedValue({ id: 5, status: 'pending' });

    const res = await request(buildApp()).post('/analyze').send({ url: 'https://github.com/foo/bar' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);
    expect(res.body.status).toBe('pending');
  });
});

describe('GET /report/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for non-numeric id', async () => {
    const res = await request(buildApp()).get('/report/abc');
    expect(res.status).toBe(400);
  });

  it('returns 404 when repo not found', async () => {
    vi.mocked(reposDao.findRepoById).mockResolvedValue(null);
    const res = await request(buildApp()).get('/report/99');
    expect(res.status).toBe(404);
  });

  it('returns merged repo + analysis', async () => {
    vi.mocked(reposDao.findRepoById).mockResolvedValue({
      id: 1, url: 'https://github.com/foo/bar', status: 'done',
      github_data: null, created_at: new Date(), updated_at: new Date(),
    });
    vi.mocked(reportsDao.findReportByRepoId).mockResolvedValue({
      id: 1, repo_id: 1, analysis: { issues: [] }, created_at: new Date(),
    });

    const res = await request(buildApp()).get('/report/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.analysis).toEqual({ issues: [] });
  });
});

describe('GET /feed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns repos and languages', async () => {
    vi.mocked(reposDao.findAllDoneRepos).mockResolvedValue([
      {
        id: 1,
        url: 'https://github.com/foo/bar',
        status: 'done',
        github_data: { language: 'TypeScript', stars: 100, description: 'A test repo' },
        updated_at: new Date(),
        analysis: { issues: [{ number: 1, title: 'Bug', score: 8, difficulty: 'beginner', signals: {}, github_url: '' }] },
      },
    ]);

    const res = await request(buildApp()).get('/feed');
    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(1);
    expect(res.body.repos[0].name).toBe('foo/bar');
    expect(res.body.repos[0].language).toBe('TypeScript');
    expect(res.body.repos[0].top_issues).toHaveLength(1);
    expect(res.body.languages).toContain('TypeScript');
  });

  it('returns empty feed when no repos analyzed', async () => {
    vi.mocked(reposDao.findAllDoneRepos).mockResolvedValue([]);
    const res = await request(buildApp()).get('/feed');
    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(0);
    expect(res.body.languages).toHaveLength(0);
  });
});

describe('GET /research/:repoId/:issueNumber', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid params', async () => {
    const res = await request(buildApp()).get('/research/abc/xyz');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not cached and not running', async () => {
    vi.mocked(issueResearchDao.findIssueResearch).mockResolvedValue(null);
    const res = await request(buildApp()).get('/research/1/42');
    expect(res.status).toBe(404);
  });

  it('returns cached research when available', async () => {
    vi.mocked(issueResearchDao.findIssueResearch).mockResolvedValue({
      id: 1, repo_id: 1, issue_number: 42,
      research: { summary: 'Test issue', approach: 'Fix it' },
      created_at: new Date(),
    });

    const res = await request(buildApp()).get('/research/1/42');
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
    expect(res.body.research.summary).toBe('Test issue');
  });
});

describe('POST /cancel/:id', () => {
  it('returns cancelled true for valid id', async () => {
    const res = await request(buildApp()).post('/cancel/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cancelled');
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await request(buildApp()).post('/cancel/abc');
    expect(res.status).toBe(400);
  });
});
