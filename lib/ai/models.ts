// Maps the abstract capability tier (HAIKU/SONNET/OPUS) to a concrete model id
// per provider. Centralised here so model ids live in exactly one place — and
// each is overridable via env, so Walid can bump a model name without a code
// change or redeploy (handy when a provider ships a newer/cheaper model).

import type { AiProviderId, ModelTier } from './types';

type TierMap = Record<ModelTier, string>;

const ANTHROPIC_MODELS: TierMap = {
  HAIKU: process.env.ANTHROPIC_MODEL_HAIKU ?? 'claude-haiku-4-5-20251001',
  SONNET: process.env.ANTHROPIC_MODEL_SONNET ?? 'claude-sonnet-4-6',
  OPUS: process.env.ANTHROPIC_MODEL_OPUS ?? 'claude-opus-4-8',
};

// Gemini ids are intentionally conservative defaults; override via env if a
// newer model is available in the company's region. Flash is the cost lever
// the platform leans on (cheap, fast) — it's the default for chat.
const GOOGLE_MODELS: TierMap = {
  HAIKU: process.env.GOOGLE_MODEL_FAST ?? 'gemini-2.0-flash',
  SONNET: process.env.GOOGLE_MODEL_BALANCED ?? 'gemini-2.0-flash',
  OPUS: process.env.GOOGLE_MODEL_ADVANCED ?? 'gemini-2.5-pro',
};

export function resolveModel(provider: AiProviderId, tier: ModelTier): string {
  return provider === 'google' ? GOOGLE_MODELS[tier] : ANTHROPIC_MODELS[tier];
}
