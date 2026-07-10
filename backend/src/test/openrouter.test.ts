import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { modelChain, complete } from '../services/openrouter';

const realFetch = global.fetch;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  delete process.env.OPENROUTER_MODEL;
  delete process.env.OPENROUTER_MODEL_FALLBACKS;
});

afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('modelChain', () => {
  it('defaults to gpt-4o-mini', () => {
    expect(modelChain()).toEqual(['openai/gpt-4o-mini']);
  });

  it('uses env primary and fallbacks, deduped', () => {
    process.env.OPENROUTER_MODEL = 'a/one';
    process.env.OPENROUTER_MODEL_FALLBACKS = 'b/two, a/one , c/three';
    expect(modelChain()).toEqual(['a/one', 'b/two', 'c/three']);
  });
});

describe('complete', () => {
  it('falls back to the next model when the first fails', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    process.env.OPENROUTER_MODEL = 'a/bad';
    process.env.OPENROUTER_MODEL_FALLBACKS = 'b/good';

    const models: string[] = [];
    global.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string) as { model: string };
      models.push(body.model);
      if (body.model === 'a/bad') return new Response('nope', { status: 400 });
      return new Response(
        JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }] }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const res = await complete({ messages: [{ role: 'user', content: 'x' }] });
    expect(res.choices[0].message.content).toBe('hi');
    expect(models).toEqual(['a/bad', 'b/good']);
  });

  it('throws the last error when all models fail', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    process.env.OPENROUTER_MODEL = 'a/bad';

    global.fetch = vi.fn(async () => new Response('nope', { status: 400 })) as unknown as typeof fetch;

    await expect(complete({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(/OpenRouter 400/);
  });
});
