import { Router, Request, Response } from 'express';
import { findRepoById } from '../dao/repos';
import { findReportByRepoId } from '../dao/reports';
import { getConversation, appendTurns } from '../dao/conversations';
import { askRepo } from '../services/chat';
import { asyncRoute } from '../middleware/errors';
import { log } from '../services/logger';

export const askRouter = Router();

function sse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

askRouter.post(
  '/ask',
  asyncRoute(async (req: Request, res: Response) => {
    const { repo_id, question, session_id } = req.body as {
      repo_id?: unknown;
      question?: unknown;
      session_id?: unknown;
    };

    if (typeof repo_id !== 'number' || !Number.isInteger(repo_id)) {
      res.status(400).json({ error: 'repo_id (integer) is required' });
      return;
    }
    if (typeof question !== 'string' || !question.trim() || question.length > 2000) {
      res.status(400).json({ error: 'question (string, ≤2000 chars) is required' });
      return;
    }
    if (typeof session_id !== 'string' || !session_id || session_id.length > 100) {
      res.status(400).json({ error: 'session_id (string, ≤100 chars) is required' });
      return;
    }

    const repo = await findRepoById(repo_id);
    if (!repo) {
      res.status(404).json({ error: 'repo not found' });
      return;
    }
    const report = await findReportByRepoId(repo_id);
    if (!report?.analysis) {
      res.status(409).json({ error: 'repo has no analysis yet — analyze it first' });
      return;
    }

    const history = await getConversation(repo_id, session_id);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    try {
      const { answer, followups } = await askRepo(
        { url: repo.url, analysis: report.analysis, github_data: repo.github_data },
        history,
        question.trim(),
        (text) => sse(res, 'token', { text }),
        controller.signal
      );

      const now = new Date().toISOString();
      await appendTurns(repo_id, session_id, [
        { role: 'user', content: question.trim(), created_at: now },
        { role: 'assistant', content: answer, created_at: now },
      ]);

      sse(res, 'followups', { questions: followups });
      sse(res, 'done', {});
    } catch (err) {
      if (!controller.signal.aborted) {
        log.error({ err, repo_id }, 'chat failed');
        sse(res, 'error', { message: 'chat failed — try again' });
      }
    } finally {
      res.end();
    }
  })
);

askRouter.get(
  '/conversations/:repoId',
  asyncRoute(async (req: Request, res: Response) => {
    const repoId = parseInt(req.params.repoId, 10);
    const sessionId = req.query.session_id;
    if (isNaN(repoId) || typeof sessionId !== 'string' || !sessionId) {
      res.status(400).json({ error: 'repoId and session_id are required' });
      return;
    }
    const messages = await getConversation(repoId, sessionId);
    res.json({ messages });
  })
);
