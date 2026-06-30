import '@testing-library/jest-dom';

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = () => {};

// jsdom doesn't implement WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close() {}
  send() {}
}
(global as unknown as Record<string, unknown>).WebSocket = MockWebSocket;
