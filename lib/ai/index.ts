// Entry point for the AI layer. Given a company, it loads that company's BYOK
// settings, decrypts the key, and returns the matching provider adapter. The
// agent loop and chat routes import only from here.

import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { createAnthropicProvider } from './providers/anthropic';
import { createGoogleProvider } from './providers/google';
import { createOpenAiProvider } from './providers/openai';
import { createVertexProvider, isVertexConfigured } from './providers/vertex';
import type { AiProvider, AiProviderId } from './types';

export * from './types';
export { resolveModel } from './models';

export type AiMode = 'byok' | 'managed';

// Managed (default) = platform pays via Vertex AI (one service account) + token
// bank. BYOK = each company brings its own AI Studio/Anthropic key (opt-in via
// AI_MODE=byok). Vertex is the standard path; BYOK adapters are kept only as an
// optional fallback.
export function getAiMode(): AiMode {
  return process.env.AI_MODE === 'byok' ? 'byok' : 'managed';
}

export type GetProviderResult =
  | { ok: true; provider: AiProvider }
  | { ok: false; reason: 'no_settings' | 'no_key' | 'decrypt_failed' | 'vertex_not_configured' };

function buildProvider(providerId: string, apiKey: string): AiProvider {
  // CompanyApiSettings.byokProvider is a free-text column; normalise it.
  if (providerId === 'google') return createGoogleProvider(apiKey);
  if (providerId === 'openai') return createOpenAiProvider(apiKey);
  return createAnthropicProvider(apiKey);
}

// Build a provider from the PLATFORM's own credentials for a specific vendor, or
// null when that vendor isn't configured. This is what lets an owner pin one
// agent to (say) GPT-4o while the company default stays managed Gemini/Vertex —
// the registry model carries its provider, and we spin up that vendor's adapter
// with the platform key. Spend is still gated by the token bank.
export function platformProvider(providerId: string): AiProvider | null {
  switch (providerId) {
    case 'vertex':
      return isVertexConfigured() ? createVertexProvider() : null;
    case 'openai': {
      const key = process.env.OPENAI_API_KEY;
      return key ? createOpenAiProvider(key) : null;
    }
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY;
      return key ? createAnthropicProvider(key) : null;
    }
    case 'google': {
      const key = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
      return key ? createGoogleProvider(key) : null;
    }
    default:
      return null;
  }
}

// Given the company's DEFAULT provider result and an agent's chosen registry
// model, return the provider that should actually run: a model pins its own
// vendor (built from platform creds), otherwise the company default (+ tier).
// Falls back to the default when the pinned vendor isn't configured — matching
// agentModelId(), which then returns undefined so the tier map is used. Sync, so
// callers that fetched the default in a Promise.all can override without a
// second round-trip.
export function providerForAgentModel(
  defaultResult: GetProviderResult,
  model: { provider: string; enabled: boolean } | null | undefined
): GetProviderResult {
  if (model && model.enabled) {
    // Company default already on the model's vendor (e.g. managed Vertex + a
    // Gemini model) — keep it; no need to rebuild.
    if (defaultResult.ok && defaultResult.provider.id === model.provider) return defaultResult;
    const pinned = platformProvider(model.provider);
    if (pinned) return { ok: true, provider: pinned };
    // Vendor not configured → fall through to the default (tier fallback).
  }
  return defaultResult;
}

// Convenience for callers that load the agent before resolving the provider:
// the company default, overridden by the agent's pinned model vendor.
export async function getProviderForModel(
  companyId: string,
  model: { provider: string; enabled: boolean } | null | undefined
): Promise<GetProviderResult> {
  const base = await getProviderForCompany(companyId);
  return providerForAgentModel(base, model);
}

export async function getProviderForCompany(
  companyId: string
): Promise<GetProviderResult> {
  // Managed mode: every company uses the platform's Vertex credentials. No
  // per-company key is needed; spend is gated by the token bank instead.
  if (getAiMode() === 'managed') {
    if (!isVertexConfigured()) return { ok: false, reason: 'vertex_not_configured' };
    return { ok: true, provider: createVertexProvider() };
  }

  const settings = await db.companyApiSettings.findUnique({
    where: { companyId },
    select: { byokApiKey: true, byokProvider: true },
  });

  if (!settings) return { ok: false, reason: 'no_settings' };
  if (!settings.byokApiKey) return { ok: false, reason: 'no_key' };

  let apiKey: string;
  try {
    apiKey = decrypt(settings.byokApiKey);
  } catch (err) {
    // Usually means ENCRYPTION_KEY rotated — the company must re-enter the key.
    console.error('BYOK decrypt failed for company', companyId, err);
    return { ok: false, reason: 'decrypt_failed' };
  }

  return { ok: true, provider: buildProvider(settings.byokProvider, apiKey) };
}
