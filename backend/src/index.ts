import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { analyzeRouter } from './routes/analyze';
import { feedRouter } from './routes/feed';
import { researchRouter } from './routes/research';
import { matchRouter } from './routes/match';
import { askRouter } from './routes/ask';
import { statsRouter } from './routes/stats';
import { initDb, closeDb } from './services/db';
import { eventBus } from './services/event-bus';
import { rateLimit } from './middleware/rate-limit';
import { errorHandler } from './middleware/errors';
import { log } from './services/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const limiter = rateLimit();
app.post(['/analyze', '/match', '/ask', '/research/:repoId/:issueNumber'], limiter);

app.use('/', analyzeRouter);
app.use('/', feedRouter);
app.use('/', researchRouter);
app.use('/', matchRouter);
app.use('/', askRouter);
app.use('/', statsRouter);

app.use(errorHandler);

const httpServer = http.createServer(app);

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (socket, req) => {
  const url = new URL(req.url ?? '', `http://localhost:${PORT}`);
  const rawId = url.searchParams.get('id');
  const repoId = rawId ? parseInt(rawId, 10) : NaN;

  if (isNaN(repoId)) {
    socket.close(1008, 'missing ?id=');
    return;
  }

  eventBus.subscribe(repoId, socket);
});

async function start() {
  await initDb();
  httpServer.listen(PORT, () => {
    log.info({ port: PORT }, 'beacon backend started');
  });
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'shutting down');

  for (const client of wss.clients) client.close(1001, 'server shutting down');
  wss.close();

  httpServer.close(async () => {
    await closeDb().catch(() => {});
    process.exit(0);
  });

  // Force exit if connections refuse to drain
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start().catch((err) => {
  log.error({ err }, 'failed to start');
  process.exit(1);
});

export { app };
