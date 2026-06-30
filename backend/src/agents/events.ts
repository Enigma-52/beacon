/** All events the analysis agent can emit. Shared shape with the frontend. */

export type AgentEvent =
  | { type: 'started'; owner: string; repo: string; model: string }
  | { type: 'iteration'; iteration: number; messageCount: number }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; success: boolean; summary: string }
  | { type: 'done'; iterations: number; totalTokens: number }
  | { type: 'error'; message: string };

export type AgentEmitter = (event: AgentEvent) => void;

export const noopEmitter: AgentEmitter = () => {};
