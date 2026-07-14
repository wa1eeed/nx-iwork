// Provider-agnostic AI layer.
//
// NX iWork is BYOK: every company plugs in its own key, and may pick a
// different *provider* (Anthropic Claude or Google Gemini). The rest of the
// codebase (agent loop, chat, scheduled tasks) talks to this neutral
// interface and never imports a vendor SDK directly. Adding a provider later
// means adding one file under lib/ai/providers/ — nothing else changes.

import type { ClaudeModel } from '@prisma/client';

// The DB enum (HAIKU/SONNET/OPUS) predates multi-provider support. We treat it
// as an abstract capability tier, and each provider maps the tier to one of its
// own concrete model ids in lib/ai/models.ts:
//   HAIKU  -> fast & cheap      (most chat / customer-service replies)
//   SONNET -> balanced          (default for reasoning + tool use)
//   OPUS   -> most capable      (research, complex multi-step tasks)
export type ModelTier = ClaudeModel;

export type AiProviderId = 'anthropic' | 'google' | 'vertex' | 'openai';

export type AiRole = 'user' | 'assistant';

// A model's request to run one of the tools we offered it.
export interface AiToolCall {
  /** Provider-assigned id, echoed back when we return the result. */
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// Conversation turns. Beyond plain text, an assistant turn may carry tool
// calls, and a tool turn carries the result we computed for one of them.
export type AiMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: AiToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

// A capability we expose to the model. `parameters` is a JSON-Schema object
// describing the arguments (kept to the common subset both providers accept:
// type/properties/required/enum/description/items).
export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiCompletionRequest {
  /** Persona + company context. Sent as the provider's system instruction. */
  system: string;
  /** Conversation so far, oldest first. Must end with a user/tool message. */
  messages: AiMessage[];
  tier: ModelTier;
  /** Concrete model id (from the AiModel registry). Overrides the tier→id map
   *  when set; otherwise the provider resolves the tier to its default id. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Tools the model may call this turn. */
  tools?: AiTool[];
  /** Abort if the provider hangs (network, cold model). */
  timeoutMs?: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiCompletion {
  text: string;
  /** Tools the model wants run before it can finish (empty when it's done). */
  toolCalls: AiToolCall[];
  /** True when the model stopped to wait for tool results. */
  needsTools: boolean;
  usage: AiUsage;
  /** Concrete model id actually used, for logging/audit. */
  model: string;
}

export interface AiProvider {
  readonly id: AiProviderId;
  complete(req: AiCompletionRequest): Promise<AiCompletion>;
  // Optional streaming variant: yields text deltas as they're generated and
  // returns the full completion (text + toolCalls + usage). Providers without
  // it fall back to the non-streaming path.
  completeStream?(req: AiCompletionRequest): AsyncGenerator<string, AiCompletion, void>;
}
