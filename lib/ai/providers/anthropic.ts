// Anthropic Claude adapter. Uses the REST Messages API directly (same endpoint
// and version as lib/byok.ts key-testing) rather than the SDK, so both
// providers share one code shape and we control timeouts/error handling.

import { resolveModel } from '../models';
import type {
  AiCompletion,
  AiCompletionRequest,
  AiMessage,
  AiProvider,
  AiToolCall,
} from '../types';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Translate our neutral messages into Anthropic's content-block format. Tool
// results are sent as a user turn carrying a tool_result block (Anthropic's
// convention), and assistant tool calls as tool_use blocks.
function toAnthropicMessages(messages: AiMessage[]) {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'user' as const,
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId,
            content: m.content,
          },
        ],
      };
    }
    if (m.role === 'assistant') {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
      }
      // An assistant turn must have at least one block.
      if (blocks.length === 0) blocks.push({ type: 'text', text: '' });
      return { role: 'assistant' as const, content: blocks };
    }
    return { role: 'user' as const, content: m.content };
  });
}

export function createAnthropicProvider(apiKey: string): AiProvider {
  return {
    id: 'anthropic',
    async complete(req: AiCompletionRequest): Promise<AiCompletion> {
      const model = req.model ?? resolveModel('anthropic', req.tier);

      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
        system: req.system,
        messages: toAnthropicMessages(req.messages),
      };
      if (req.tools?.length) {
        body.tools = req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters,
        }));
      }

      const res = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(req.timeoutMs ?? 60_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`anthropic_${res.status}: ${detail.slice(0, 300)}`);
      }

      const data = await res.json();
      const blocks: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }> = Array.isArray(data.content) ? data.content : [];

      const text = blocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');

      const toolCalls: AiToolCall[] = blocks
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({
          id: b.id ?? '',
          name: b.name ?? '',
          args: b.input ?? {},
        }));

      return {
        text,
        toolCalls,
        needsTools: data.stop_reason === 'tool_use',
        model,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}
