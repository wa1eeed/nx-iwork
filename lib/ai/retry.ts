// Resilient AI calls: exponential backoff + jitter for transient provider
// failures (Gemini 429 / RESOURCE_EXHAUSTED rate limits, 5xx, timeouts). Keeps
// client transactions from failing on a momentary rate cap. Non-transient errors
// (bad request, auth) propagate immediately so we don't mask real bugs.

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const v of [e?.status, e?.code, e?.response?.status]) {
    if (typeof v === 'number') return v;
  }
  return undefined;
}

export function isTransientAiError(err: unknown): boolean {
  const status = statusOf(err);
  if (status !== undefined && TRANSIENT_STATUS.has(status)) return true;
  const msg = String((err as { message?: unknown })?.message ?? err).toLowerCase();
  return /\b429\b|rate.?limit|resource_exhausted|unavailable|overloaded|deadline|timed?.?out|temporar|econnreset|etimedout|socket hang|503|502/.test(
    msg
  );
}

export interface RetryOptions {
  retries?: number; // max retry attempts (after the first try)
  baseMs?: number; // first backoff
  maxMs?: number; // cap per-attempt backoff
  label?: string; // for logging
}

export async function withAiRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 4;
  const base = opts.baseMs ?? 500;
  const max = opts.maxMs ?? 8000;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isTransientAiError(err)) throw err;
      // Exponential backoff with full jitter.
      const ceiling = Math.min(max, base * 2 ** (attempt - 1));
      const delay = Math.floor(Math.random() * ceiling);
      console.warn(`[ai-retry${opts.label ? `:${opts.label}` : ''}] transient error, attempt ${attempt}/${retries}, waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
