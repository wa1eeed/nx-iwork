// BYOK = Bring Your Own Key. Each customer plugs in their own Anthropic key.
// We test the key with a 1-token /v1/messages call (the same endpoint we use
// in production), so a "verified" key is guaranteed to work for chat — listing
// /v1/models would only prove the key authenticates, not that it can run msgs.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TEST_MODEL = 'claude-haiku-4-5-20251001';

export type ByokTestResult =
  | { ok: true }
  | { ok: false; reason: string; status?: number };

export async function testAnthropicKey(apiKey: string): Promise<ByokTestResult> {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return { ok: false, reason: 'invalid_format' };
  }

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: TEST_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      // Avoid hanging on a stuck network — Coolify deploys can sit on slow DNS.
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { ok: true };

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'unauthorized', status: res.status };
    }
    if (res.status === 429) {
      return { ok: false, reason: 'rate_limited', status: res.status };
    }
    return { ok: false, reason: 'api_error', status: res.status };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  }
}

// Tests a Google (Gemini) AI Studio / Generative Language key with a 1-token
// generateContent call — the same surface the runtime uses, so "verified" means
// the key can actually generate, not just authenticate.
export async function testGoogleKey(apiKey: string): Promise<ByokTestResult> {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return { ok: false, reason: 'invalid_format' };
  }

  const model = process.env.GOOGLE_MODEL_FAST ?? 'gemini-2.0-flash';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { ok: true };
    // Google returns 400 with API_KEY_INVALID for bad keys.
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'unauthorized', status: res.status };
    }
    if (res.status === 429) {
      return { ok: false, reason: 'rate_limited', status: res.status };
    }
    return { ok: false, reason: 'api_error', status: res.status };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  }
}

// Dispatches to the right key-test by provider. Defaults to anthropic to match
// CompanyApiSettings.byokProvider's default.
export function testKey(
  provider: string,
  apiKey: string
): Promise<ByokTestResult> {
  return provider === 'google'
    ? testGoogleKey(apiKey)
    : testAnthropicKey(apiKey);
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  const last4 = key.slice(-4);
  return `••••••••${last4}`;
}
