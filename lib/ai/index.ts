// Entry point for the AI layer. Given a company, it loads that company's BYOK
// settings, decrypts the key, and returns the matching provider adapter. The
// agent loop and chat routes import only from here.

import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { createAnthropicProvider } from './providers/anthropic';
import { createGoogleProvider } from './providers/google';
import { createVertexProvider, isVertexConfigured } from './providers/vertex';
import type { AiProvider, AiProviderId } from './types';

export * from './types';
export { resolveModel } from './models';

export type AiMode = 'byok' | 'managed';

// Managed = platform pays via Vertex (one service account) + token bank.
// BYOK = each company brings its own key. Default BYOK.
export function getAiMode(): AiMode {
  return process.env.AI_MODE === 'managed' ? 'managed' : 'byok';
}

export type GetProviderResult =
  | { ok: true; provider: AiProvider }
  | { ok: false; reason: 'no_settings' | 'no_key' | 'decrypt_failed' | 'vertex_not_configured' };

function buildProvider(providerId: string, apiKey: string): AiProvider {
  // CompanyApiSettings.byokProvider is a free-text column; normalise it.
  const id: AiProviderId = providerId === 'google' ? 'google' : 'anthropic';
  return id === 'google'
    ? createGoogleProvider(apiKey)
    : createAnthropicProvider(apiKey);
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
