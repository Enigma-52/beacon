import type { Request, Response, NextFunction } from 'express';
import { log } from '../services/logger';

/** Structured request log with latency; skips noisy health checks. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') { next(); return; }
  const start = Date.now();
  res.on('finish', () => {
    log.info(
      { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start },
      'request'
    );
  });
  next();
}

/** Last-resort Express error handler — logs detail, responds generic. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  log.error({ err, path: req.path, method: req.method }, 'unhandled route error');
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal server error' });
}

/** Wraps an async route so rejections reach the error handler. */
export function asyncRoute(
  fn: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}
