import Ajv from 'ajv';
import { AnalysisSchema } from '../schemas';
import type { Analysis } from '../schemas';
import { ALL_TOOLS } from '../tools/definitions';
import { executeTool } from '../tools/executor';
import type { ToolCall, AnalysisDone } from '../tools/executor';
import { ANALYSIS_SYSTEM_PROMPT } from '../prompts/analysis.prompt';
import { log } from '../services/logger';
import type { AgentEmitter } from './events';
import { noopEmitter } from './events';

const ajv = new Ajv({ strict: false });
const validateAnalysis = ajv.compile(AnalysisSchema);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const MAX_ITERATIONS = 20;
const MAX_CONSECUTIVE_ERRORS = 4;

type Role = 'system' | 'user' | 'assistant' | 'tool';

interface Message {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface OpenRouterResponse {
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callLLM(messages: Message[], model: string, signal: AbortSignal): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/beacon',
      'X-Title': 'Beacon',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: ALL_TOOLS,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }

  return res.json() as Promise<OpenRouterResponse>;
}

export async function runAnalysisAgent(
  owner: string,
  repo: string,
  emit: AgentEmitter = noopEmitter,
  signal: AbortSignal = new AbortController().signal
): Promise<Analysis> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  log.info({ owner, repo, model }, 'analysis agent started');
  emit({ type: 'started', owner, repo, model });

  const messages: Message[] = [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analyze the GitHub repository: ${owner}/${repo}. When done, call produce_analysis with your findings.`,
    },
  ];

  let iterations = 0;
  let totalTokens = 0;
  let consecutiveErrors = 0;

  while (iterations < MAX_ITERATIONS) {
    if (signal.aborted) {
      const msg = 'Analysis cancelled';
      emit({ type: 'error', message: msg });
      throw new Error(msg);
    }

    iterations++;
    emit({ type: 'iteration', iteration: iterations, messageCount: messages.length });
    log.info({ iteration: iterations, messageCount: messages.length }, 'agent iteration');

    const response = await callLLM(messages, model, signal);
    const choice = response.choices[0];

    if (response.usage) {
      totalTokens += response.usage.total_tokens;
    }

    messages.push({
      role: 'assistant',
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    });

    if (choice.finish_reason === 'stop') {
      log.warn('agent stopped without produce_analysis — prompting');
      messages.push({
        role: 'user',
        content: 'You must call produce_analysis with your findings to complete the analysis.',
      });
      continue;
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;

        emit({ type: 'tool_call', name, args });

        const result = await executeTool(toolCall, owner, repo);

        if ('done' in result) {
          const done = result as AnalysisDone;
          log.info({ iterations, totalTokens }, 'produce_analysis called — validating');

          if (!validateAnalysis(done.payload)) {
            const msg = `produce_analysis failed schema: ${JSON.stringify(validateAnalysis.errors)}`;
            emit({ type: 'error', message: msg });
            throw new Error(msg);
          }

          log.info({ iterations, totalTokens }, 'agent complete');
          emit({ type: 'done', iterations, totalTokens });
          return done.payload as Analysis;
        }

        const isError = result.summary.startsWith('error:');
        if (isError) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            // Prompt LLM to wrap up with what it knows
            messages.push({
              role: 'tool',
              tool_call_id: result.tool_call_id,
              content: result.content,
            });
            messages.push({
              role: 'user',
              content:
                'Several tools have failed. Please call produce_analysis now with your best assessment based on what you have gathered so far. Use "unknown" where data is unavailable.',
            });
            consecutiveErrors = 0;
            emit({ type: 'tool_result', name, success: false, summary: result.summary });
            break;
          }
        } else {
          consecutiveErrors = 0;
        }

        emit({ type: 'tool_result', name, success: !isError, summary: result.summary });

        messages.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.content,
        });
      }
    }
  }

  const msg = `Agent exceeded ${MAX_ITERATIONS} iterations`;
  emit({ type: 'error', message: msg });
  throw new Error(msg);
}
