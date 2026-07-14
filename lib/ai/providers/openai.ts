// OpenAI adapter. Uses the REST Chat Completions API directly (same shape as the
// Anthropic adapter) so every provider shares one code path and we control
// timeouts / error handling / streaming. Powers the "switch a specific agent to
// GPT-4o" path once an OpenAI model is added in the /admin/models registry and
// the platform OPENAI_API_KEY is set.

import { resolveModel } from '../models';
import type {
  AiCompletion,
  AiCompletionRequest,
  AiMessage,
  AiProvider,
  AiToolCall,
  AiTool,
} from '../types';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

// Tool-call arguments arrive as a JSON string; never throw on a malformed one.
function safeArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Translate our neutral messages into OpenAI's chat format. Assistant tool calls
// become `tool_calls` (arguments are a JSON string), and each tool result is a
// `tool` turn keyed by the call id the assistant used.
function toOpenAiMessages(system: string, messages: AiMessage[]) {
  const out: Array<Record<string, unknown>> = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    } else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: m.content || '' };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
        }));
      }
      out.push(msg);
    } else {
      out.push({ role: 'user', content: m.content });
    }
  }
  return out;
}

function toOpenAiTools(tools: AiTool[] | undefined) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

// Note: mainstream chat models (gpt-4o, gpt-4o-mini, gpt-4.1) accept `max_tokens`
// + a custom `temperature`. The o-series reasoning models reject both — add a
// per-model quirk map here if the owner ever registers one.
function buildBody(req: AiCompletionRequest, model: string, stream: boolean) {
  const body: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(req.system, req.messages),
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 4096,
  };
  const tools = toOpenAiTools(req.tools);
  if (tools) body.tools = tools;
  if (stream) {
    body.stream = true;
    // Ask for a final usage chunk so the token bank stays accurate when streaming.
    body.stream_options = { include_usage: true };
  }
  return body;
}

export function createOpenAiProvider(apiKey: string): AiProvider {
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };

  return {
    id: 'openai',

    async complete(req: AiCompletionRequest): Promise<AiCompletion> {
      const model = req.model ?? resolveModel('openai', req.tier);

      const res = await fetch(OPENAI_API, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildBody(req, model, false)),
        signal: AbortSignal.timeout(req.timeoutMs ?? 60_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`openai_${res.status}: ${detail.slice(0, 300)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message ?? {};
      const text = typeof msg.content === 'string' ? msg.content : '';

      const toolCalls: AiToolCall[] = Array.isArray(msg.tool_calls)
        ? msg.tool_calls.map((tc: { id?: string; function?: { name?: string; arguments?: string } }) => ({
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            args: safeArgs(tc.function?.arguments),
          }))
        : [];

      return {
        text,
        toolCalls,
        needsTools: choice?.finish_reason === 'tool_calls' || toolCalls.length > 0,
        model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    },

    async *completeStream(
      req: AiCompletionRequest
    ): AsyncGenerator<string, AiCompletion, void> {
      const model = req.model ?? resolveModel('openai', req.tier);

      const res = await fetch(OPENAI_API, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildBody(req, model, true)),
        signal: AbortSignal.timeout(req.timeoutMs ?? 60_000),
      });

      if (!res.ok || !res.body) {
        const detail = res.body ? await res.text().catch(() => '') : '';
        throw new Error(`openai_${res.status}: ${detail.slice(0, 300)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let finishReason = '';
      // Tool calls stream as fragments keyed by index; accumulate name + args.
      const toolAcc: Record<number, { id: string; name: string; args: string }> = {};
      let usage = { inputTokens: 0, outputTokens: 0 };

      // Parse a single SSE `data:` payload, mutating the accumulators above.
      const consume = function* (payload: string): Generator<string, void, void> {
        if (payload === '[DONE]') return;
        let chunk: {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string;
          }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          return;
        }
        const choice = chunk.choices?.[0];
        if (choice) {
          const delta = choice.delta ?? {};
          if (typeof delta.content === 'string' && delta.content) {
            fullText += delta.content;
            yield delta.content;
          }
          for (const tc of delta.tool_calls ?? []) {
            const idx = tc.index ?? 0;
            const acc = (toolAcc[idx] ??= { id: '', name: '', args: '' });
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
          }
          if (choice.finish_reason) finishReason = choice.finish_reason;
        }
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
        }
      };

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          yield* consume(trimmed.slice(5).trim());
        }
      }

      const toolCalls: AiToolCall[] = Object.values(toolAcc)
        .filter((a) => a.name)
        .map((a) => ({ id: a.id, name: a.name, args: safeArgs(a.args) }));

      return {
        text: fullText,
        toolCalls,
        needsTools: finishReason === 'tool_calls' || toolCalls.length > 0,
        model,
        usage,
      };
    },
  };
}
