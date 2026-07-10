import Ajv from 'ajv';
import { AnalysisSchema } from '../schemas';
import type { Analysis } from '../schemas';
import { ALL_TOOLS } from '../tools/definitions';
import { executeTool } from '../tools/executor';
import type { AnalysisDone } from '../tools/executor';
import { ANALYSIS_SYSTEM_PROMPT } from '../prompts/analysis.prompt';
import { complete, modelChain } from '../services/openrouter';
import type { ChatMessage } from '../services/openrouter';
import { log } from '../services/logger';
import type { AgentEmitter } from './events';
import { noopEmitter } from './events';

const ajv = new Ajv({ strict: false });
const validateAnalysis = ajv.compile(AnalysisSchema);

const MAX_ITERATIONS = 20;
const MAX_CONSECUTIVE_ERRORS = 4;

export function tokenBudget(): number {
  const raw = Number(process.env.AGENT_TOKEN_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : 150_000;
}

export interface AnalysisRunMeta {
  model: string;
  iterations: number;
  total_tokens: number;
  duration_ms: number;
}

export interface AnalysisResult {
  analysis: Analysis;
  meta: AnalysisRunMeta;
}

export async function runAnalysisAgent(
  owner: string,
  repo: string,
  emit: AgentEmitter = noopEmitter,
  signal: AbortSignal = new AbortController().signal
): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const model = modelChain()[0];

  log.info({ owner, repo, model }, 'analysis agent started');
  emit({ type: 'started', owner, repo, model });

  const messages: ChatMessage[] = [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analyze the GitHub repository: ${owner}/${repo}. When done, call produce_analysis with your findings.`,
    },
  ];

  let iterations = 0;
  let totalTokens = 0;
  let consecutiveErrors = 0;
  let budgetWarned = false;
  const budget = tokenBudget();

  while (iterations < MAX_ITERATIONS) {
    if (signal.aborted) {
      const msg = 'Analysis cancelled';
      emit({ type: 'error', message: msg });
      throw new Error(msg);
    }

    iterations++;
    emit({ type: 'iteration', iteration: iterations, messageCount: messages.length });
    log.info({ iteration: iterations, messageCount: messages.length }, 'agent iteration');

    const response = await complete({ messages, tools: ALL_TOOLS, temperature: 0.2, signal });
    const choice = response.choices[0];

    if (response.usage) {
      totalTokens += response.usage.total_tokens;
    }

    if (totalTokens > budget && !budgetWarned) {
      budgetWarned = true;
      log.warn({ totalTokens, budget }, 'token budget exceeded — asking agent to finish');
      messages.push({
        role: 'user',
        content: 'Token budget reached. Call produce_analysis NOW with your findings so far. Use "unknown" where data is missing.',
      });
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
          return {
            analysis: done.payload as Analysis,
            meta: { model, iterations, total_tokens: totalTokens, duration_ms: Date.now() - startedAt },
          };
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
