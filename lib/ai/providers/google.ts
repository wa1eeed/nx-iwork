// Google Gemini adapter. Uses the Generative Language REST API, which accepts a
// plain AI Studio API key (key=... query param). This is the same surface
// whether the key comes from AI Studio (free tier, great for demos) or a
// Vertex/Cloud key — so the company never has to care which one they pasted.

import { resolveModel } from '../models';
import type {
  AiCompletion,
  AiCompletionRequest,
  AiMessage,
  AiProvider,
  AiToolCall,
} from '../types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini turns are sequences of "parts"; a tool result is a functionResponse
// part, an assistant tool call is a functionCall part. We name calls
// "<name>__<id>" on the way out so we can recover the original id when the
// model echoes only the function name back in its response.
function toGeminiContents(messages: AiMessage[]) {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'user' as const,
        parts: [
          {
            functionResponse: {
              name: m.name,
              response: { result: m.content },
            },
          },
        ],
      };
    }
    if (m.role === 'assistant') {
      const parts: unknown[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: tc.name, args: tc.args } });
      }
      if (parts.length === 0) parts.push({ text: '' });
      return { role: 'model' as const, parts };
    }
    return { role: 'user' as const, parts: [{ text: m.content }] };
  });
}

export function createGoogleProvider(apiKey: string): AiProvider {
  return {
    id: 'google',
    async complete(req: AiCompletionRequest): Promise<AiCompletion> {
      const model = resolveModel('google', req.tier);
      const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const body: Record<string, unknown> = {
        system_instruction: { parts: [{ text: req.system }] },
        contents: toGeminiContents(req.messages),
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 4096,
        },
      };
      if (req.tools?.length) {
        body.tools = [
          {
            functionDeclarations: req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        ];
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(req.timeoutMs ?? 60_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`google_${res.status}: ${detail.slice(0, 300)}`);
      }

      const data = await res.json();
      const parts: Array<{
        text?: string;
        functionCall?: { name: string; args?: Record<string, unknown> };
      }> = data.candidates?.[0]?.content?.parts ?? [];

      const text = parts
        .filter((p) => typeof p.text === 'string')
        .map((p) => p.text)
        .join('');

      // Gemini doesn't assign ids to calls; synthesize stable ones by index so
      // the agent loop can pair calls with results.
      const toolCalls: AiToolCall[] = parts
        .filter((p) => p.functionCall)
        .map((p, i) => ({
          id: `${p.functionCall!.name}__${i}`,
          name: p.functionCall!.name,
          args: p.functionCall!.args ?? {},
        }));

      return {
        text,
        toolCalls,
        needsTools: toolCalls.length > 0,
        model,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },
  };
}
