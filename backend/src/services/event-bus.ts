import type { WebSocket } from 'ws';
import type { AgentEvent } from '../agents/events';
import { log } from './logger';

/** Maps repoId → set of open WebSocket connections subscribed to its events. */
const subscribers = new Map<number, Set<WebSocket>>();

export const eventBus = {
  subscribe(repoId: number, socket: WebSocket): void {
    if (!subscribers.has(repoId)) subscribers.set(repoId, new Set());
    subscribers.get(repoId)!.add(socket);
    log.info({ repoId }, 'ws client subscribed');

    socket.on('close', () => {
      subscribers.get(repoId)?.delete(socket);
      log.info({ repoId }, 'ws client disconnected');
    });
  },

  emit(repoId: number, event: AgentEvent): void {
    const sockets = subscribers.get(repoId);
    if (!sockets?.size) return;

    const payload = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(payload);
      }
    }
  },

  emitterFor(repoId: number) {
    return (event: AgentEvent) => this.emit(repoId, event);
  },
};
