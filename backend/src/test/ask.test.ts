import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { askRouter } from '../routes/ask';
import * as reposDao from '../dao/repos';
import * as reportsDao from '../dao/reports';
import * as conversationsDao from '../dao/conversations';

vi.mock('../dao/repos');
vi.mock('../dao/reports');
vi.mock('../dao/conversations');
vi.mock('../services/chat', () => ({
  askRepo: vi.fn(async (_repo, _history, _q, onToken: (t: string) => void) => {
    onToken('hello');
    return { answer: 'hello', followups: ['next?'] };
  }),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', askRouter);
  return app;
}

describe('POST /ask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(conversationsDao.getConversation).mockResolvedValue([]);
    vi.mocked(conversationsDao.appendTurns).mockResolvedValue();
  });

  it('rejects missing repo_id', async () => {
    const res = await request(buildApp()).post('/ask').send({ question: 'hi', session_id: 's' });
    expect(res.status).toBe(400);
  });

  it('rejects overlong question', async () => {
    const res = await request(buildApp())
      .post('/ask')
      .send({ repo_id: 1, question: 'x'.repeat(2001), session_id: 's' });
    expect(res.status).toBe(400);
  });

  it('404s for unknown repo', async () => {
    vi.mocked(reposDao.findRepoById).mockResolvedValue(null);
    const res = await request(buildApp()).post('/ask').send({ repo_id: 9, question: 'hi', session_id: 's' });
    expect(res.status).toBe(404);
  });

  it('409s when repo has no analysis', async () => {
    vi.mocked(reposDao.findRepoById).mockResolvedValue({
      id: 1, url: 'https://github.com/foo/bar', status: 'done',
      github_data: null, created_at: new Date(), updated_at: new Date(),
    });
    vi.mocked(reportsDao.findReportByRepoId).mockResolvedValue(null);
    const res = await request(buildApp()).post('/ask').send({ repo_id: 1, question: 'hi', session_id: 's' });
    expect(res.status).toBe(409);
  });

  it('streams SSE tokens, followups, and done, and persists turns', async () => {
    vi.mocked(reposDao.findRepoById).mockResolvedValue({
      id: 1, url: 'https://github.com/foo/bar', status: 'done',
      github_data: null, created_at: new Date(), updated_at: new Date(),
    });
    vi.mocked(reportsDao.findReportByRepoId).mockResolvedValue({
      id: 1, repo_id: 1, analysis: { issues: [] }, meta: null, created_at: new Date(),
    });

    const res = await request(buildApp()).post('/ask').send({ repo_id: 1, question: 'hi', session_id: 's' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: token');
    expect(res.text).toContain('"text":"hello"');
    expect(res.text).toContain('event: followups');
    expect(res.text).toContain('event: done');
    expect(conversationsDao.appendTurns).toHaveBeenCalledOnce();
  });
});

describe('GET /conversations/:repoId', () => {
  it('requires session_id', async () => {
    const res = await request(buildApp()).get('/conversations/1');
    expect(res.status).toBe(400);
  });

  it('returns messages', async () => {
    vi.mocked(conversationsDao.getConversation).mockResolvedValue([
      { role: 'user', content: 'hi', created_at: new Date().toISOString() },
    ]);
    const res = await request(buildApp()).get('/conversations/1?session_id=s');
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
  });
});
