// Google Cloud Vertex AI adapter (official @google-cloud/vertexai SDK).
//
// Used in managed mode: the PLATFORM authenticates with a service account
// (Application Default Credentials via GOOGLE_APPLICATION_CREDENTIALS) and pays
// for inference — one set of creds for all tenants, metered by the token bank.
//
// Implements the same neutral AiProvider interface as the REST adapters, so the
// agent loop / tools / token tracking are identical regardless of provider.

import { VertexAI, type Content, type Part } from '@google-cloud/vertexai';
import { resolveModel } from '../models';
import { getGcpCredentials, isGcpConfigured, ensureAdcFromEnv } from '../gcp-auth';
import { withAiRetry } from '../retry';
import type {
  AiCompletion,
  AiCompletionRequest,
  AiMessage,
  AiProvider,
  AiToolCall,
} from '../types';

// One client per process (creds + project are process-wide).
let client: VertexAI | null = null;
function getClient(): VertexAI {
  if (client) return client;
  const project = process.env.GCP_PROJECT_ID;
  if (!project) throw new Error('GCP_PROJECT_ID is not set');
  const credentials = getGcpCredentials();
  if (!credentials) ensureAdcFromEnv(); // materialize GOOGLE_APPLICATION_CREDENTIALS_JSON if set
  client = new VertexAI({
    project,
    location: process.env.GCP_LOCATION ?? 'us-central1',
    // Inline env credentials when present; otherwise the SDK uses ADC (a
    // GOOGLE_APPLICATION_CREDENTIALS file, the JSON we just materialized, or the
    // ambient metadata server on GCP).
    ...(credentials ? { googleAuthOptions: { credentials } } : {}),
  });
  return client;
}

export function isVertexConfigured(): boolean {
  return isGcpConfigured();
}

function toVertexContents(messages: AiMessage[]): Content[] {
  return messages.map((m): Content => {
    if (m.role === 'tool') {
      return {
        role: 'user',
        parts: [
          { functionResponse: { name: m.name, response: { result: m.content } } },
        ],
      };
    }
    if (m.role === 'assistant') {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: tc.name, args: tc.args } });
      }
      if (parts.length === 0) parts.push({ text: '' });
      return { role: 'model', parts };
    }
    return { role: 'user', parts: [{ text: m.content }] };
  });
}

export function createVertexProvider(): AiProvider {
  return {
    id: 'vertex',
    async complete(req: AiCompletionRequest): Promise<AiCompletion> {
      const modelId = resolveModel('vertex', req.tier);

      const model = getClient().getGenerativeModel({
        model: modelId,
        systemInstruction: req.system,
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 4096,
        },
        ...(req.tools?.length
          ? {
              tools: [
                {
                  functionDeclarations: req.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    // SDK types use its own Schema type; our JSON-Schema subset
                    // is compatible at runtime.
                    parameters: t.parameters as never,
                  })),
                },
              ],
            }
          : {}),
      });

      const result = await withAiRetry(
        () => model.generateContent({ contents: toVertexContents(req.messages) }),
        { label: 'vertex.complete' }
      );

      const resp = result.response;
      const parts: Part[] = resp.candidates?.[0]?.content?.parts ?? [];

      const text = parts
        .filter((p): p is Part & { text: string } => typeof p.text === 'string')
        .map((p) => p.text)
        .join('');

      const toolCalls: AiToolCall[] = parts
        .filter((p) => p.functionCall)
        .map((p, i) => ({
          id: `${p.functionCall!.name}__${i}`,
          name: p.functionCall!.name,
          args: (p.functionCall!.args ?? {}) as Record<string, unknown>,
        }));

      // Gemini 2.5 models "think" — thinking tokens are billed but land in
      // neither promptTokenCount nor candidatesTokenCount. Charge on the
      // difference from totalTokenCount so the token bank stays accurate.
      const prompt = resp.usageMetadata?.promptTokenCount ?? 0;
      const total = resp.usageMetadata?.totalTokenCount ?? 0;
      const candidates = resp.usageMetadata?.candidatesTokenCount ?? 0;
      const output = total > prompt ? total - prompt : candidates;

      return {
        text,
        toolCalls,
        needsTools: toolCalls.length > 0,
        model: modelId,
        usage: { inputTokens: prompt, outputTokens: output },
      };
    },

    async *completeStream(req: AiCompletionRequest): AsyncGenerator<string, AiCompletion, void> {
      const modelId = resolveModel('vertex', req.tier);
      const model = getClient().getGenerativeModel({
        model: modelId,
        systemInstruction: req.system,
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 4096,
        },
        ...(req.tools?.length
          ? {
              tools: [
                {
                  functionDeclarations: req.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters as never,
                  })),
                },
              ],
            }
          : {}),
      });

      const streamResult = await withAiRetry(
        () => model.generateContentStream({ contents: toVertexContents(req.messages) }),
        { label: 'vertex.stream' }
      );

      // Emit text deltas as they arrive. Function-call parts don't stream as
      // text — they surface in the final aggregated response below.
      for await (const chunk of streamResult.stream) {
        const cparts: Part[] = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const p of cparts) {
          if (typeof p.text === 'string' && p.text) yield p.text;
        }
      }

      const resp = await streamResult.response;
      const parts: Part[] = resp.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p): p is Part & { text: string } => typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      const toolCalls: AiToolCall[] = parts
        .filter((p) => p.functionCall)
        .map((p, i) => ({
          id: `${p.functionCall!.name}__${i}`,
          name: p.functionCall!.name,
          args: (p.functionCall!.args ?? {}) as Record<string, unknown>,
        }));
      const prompt = resp.usageMetadata?.promptTokenCount ?? 0;
      const total = resp.usageMetadata?.totalTokenCount ?? 0;
      const candidates = resp.usageMetadata?.candidatesTokenCount ?? 0;
      const output = total > prompt ? total - prompt : candidates;

      return {
        text,
        toolCalls,
        needsTools: toolCalls.length > 0,
        model: modelId,
        usage: { inputTokens: prompt, outputTokens: output },
      };
    },
  };
}
