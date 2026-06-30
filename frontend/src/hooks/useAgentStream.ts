import { useEffect, useRef, useState } from 'react';
import type { AgentEvent } from '../types';

export function useAgentStream(repoId: number | null) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!repoId) return;

    setEvents([]);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?id=${repoId}`);
    wsRef.current = ws;

    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as AgentEvent;
        setEvents((prev) => [...prev, event]);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      setEvents((prev) => [...prev, { type: 'error', message: 'WebSocket connection error' }]);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [repoId]);

  return events;
}
