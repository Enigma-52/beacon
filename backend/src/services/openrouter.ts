/**
 * Central OpenRouter client. All LLM calls go through here so retry,
 * model fallback, and cost controls live in one place.
 */
import { fetchWithRetry } from './http';
import { log } from './logger';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface CompletionResponse {
  choices: {
    message: { role: string; content: string | null; tool_calls?: ToolCall[] };
    finish_reason: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface CompletionOptions {
  messages: ChatMessage[];
  tools?: readonly unknown[];
  temperature?: number;
  responseFormat?: 'json_object';
  signal?: AbortSignal;
  maxTokens?: number;
}

/** Primary model plus fallbacks tried in order on provider failures. */
export function modelChain(): string[] {
  const primary = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const fallbacks = (process.env.OPENROUTER_MODEL_FALLBACKS ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

function baseHeaders(): Record<string, string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/beacon',
    'X-Title': 'Beacon',
  };
}

function buildBody(model: string, opts: CompletionOptions, stream = false): string {
  return JSON.stringify({
    model,
    messages: opts.messages,
    ...(opts.tools ? { tools: opts.tools, tool_choice: 'auto' } : {}),
    ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}),
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    temperature: opts.temperature ?? 0.2,
    ...(stream ? { stream: true } : {}),
  });
}

/**
 * One completion, walking the model fallback chain on provider errors.
 * Caller aborts (opts.signal) are re-thrown immediately, never retried.
 */
export async function complete(opts: CompletionOptions): Promise<CompletionResponse> {
  const chain = modelChain();
  let lastError: Error | null = null;

  for (const model of chain) {
    try {
      const res = await fetchWithRetry(
        OPENROUTER_URL,
        { method: 'POST', headers: baseHeaders(), body: buildBody(model, opts) },
        { retries: 2, timeoutMs: 120_000, signal: opts.signal }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenRouter ${res.status} (${model}): ${body.slice(0, 500)}`);
      }
      return (await res.json()) as CompletionResponse;
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn({ model, err: lastError.message }, 'model failed, trying next in chain');
    }
  }

  throw lastError ?? new Error('no models configured');
}

/**
 * Streaming completion: invokes onToken for each content delta and returns the
 * full text. Fallback chain applies only before the first token arrives.
 */
export async function completeStream(
  opts: CompletionOptions,
  onToken: (text: string) => void
): Promise<string> {
  const chain = modelChain();
  let lastError: Error | null = null;

  for (const model of chain) {
    let streamed = false;
    try {
      const res = await fetchWithRetry(
        OPENROUTER_URL,
        { method: 'POST', headers: baseHeaders(), body: buildBody(model, opts, true) },
        { retries: 1, timeoutMs: 120_000, signal: opts.signal }
      );
      if (!res.ok || !res.body) {
        throw new Error(`OpenRouter ${res.status} (${model}): ${(await res.text()).slice(0, 500)}`);
      }

      let full = '';
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const data = line.replace(/^data: /, '').trim();
          if (!data || data === '[DONE]' || !line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              streamed = true;
              full += text;
              onToken(text);
            }
          } catch {
            /* partial JSON across chunks — rejoin via buffer next round */
          }
        }
      }
      return full;
    } catch (err) {
      if (opts.signal?.aborted || streamed) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn({ model, err: lastError.message }, 'stream model failed, trying next in chain');
    }
  }

  throw lastError ?? new Error('no models configured');
}
