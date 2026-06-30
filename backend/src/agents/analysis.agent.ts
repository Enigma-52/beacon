import Ajv from 'ajv';
import { AnalysisSchema } from '../schemas';
import type { Analysis } from '../schemas';
import { ALL_TOOLS } from '../tools/definitions';
import { executeTool } from '../tools/executor';
import type { ToolCall, AnalysisDone } from '../tools/executor';
import { ANALYSIS_SYSTEM_PROMPT } from '../prompts/analysis.prompt';
import { log } from '../services/logger';

const ajv = new Ajv({ strict: false });
const validateAnalysis = ajv.compile(AnalysisSchema);

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const MAX_ITERATIONS = 20;

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

async function callLLM(messages: Message[]): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
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

export async function runAnalysisAgent(owner: string, repo: string): Promise<Analysis> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  log.info({ owner, repo, model }, 'analysis agent started');

  const messages: Message[] = [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analyze the GitHub repository: ${owner}/${repo}. When done, call produce_analysis with your findings.`,
    },
  ];

  let iterations = 0;
  let totalTokens = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    log.info({ iteration: iterations, messageCount: messages.length }, 'agent iteration');

    const response = await callLLM(messages);
    const choice = response.choices[0];

    if (response.usage) {
      totalTokens += response.usage.total_tokens;
      log.info({ tokens: response.usage, totalTokens }, 'token usage');
    }

    // Add assistant message to history
    messages.push({
      role: 'assistant',
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    });

    if (choice.finish_reason === 'stop') {
      // LLM stopped without calling produce_analysis — shouldn't happen but handle it
      log.warn({ content: choice.message.content }, 'agent stopped without produce_analysis, retrying');
      messages.push({
        role: 'user',
        content: 'You must call produce_analysis with your findings to complete the analysis.',
      });
      continue;
    }

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        const result = await executeTool(toolCall, owner, repo);

        if ('done' in result) {
          const done = result as AnalysisDone;
          log.info({ iterations, totalTokens }, 'agent called produce_analysis — validating');

          if (!validateAnalysis(done.payload)) {
            throw new Error(`produce_analysis payload failed schema: ${JSON.stringify(validateAnalysis.errors)}`);
          }

          log.info({ iterations, totalTokens }, 'analysis agent complete');
          return done.payload as Analysis;
        }

        messages.push(result);
      }
    }
  }

  throw new Error(`Analysis agent exceeded ${MAX_ITERATIONS} iterations`);
}
