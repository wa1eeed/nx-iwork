// Embeddings for semantic memory — via Google Gemini, consistent with the
// platform's Google-first direction (uses an AI Studio key / the free tier).
//
// gemini-embedding-001 supports Matryoshka output dims, so we request 1536 to
// match AgentMemory.embedding's vector(1536) column — no migration. Cosine
// distance (pgvector `<=>`) is scale-invariant, so reduced-dim vectors rank
// correctly without manual normalisation.
//
// Configure with GOOGLE_AI_API_KEY (platform-level, decoupled from each
// company's BYOK chat provider — so memory works even for Claude-on-chat
// companies). Unset → semantic memory disabled; recall falls back to
// importance-ranked.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GOOGLE_EMBEDDINGS_MODEL ?? 'gemini-embedding-001';

export const EMBEDDING_DIMS = 1536;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY);
}

// Returns the embedding vector, or null when embeddings aren't configured or the
// call fails (callers degrade to non-vector behaviour).
export async function getEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;

  const url = `${BASE}/${MODEL}:embedContent?key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: EMBEDDING_DIMS,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('Embeddings error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const vec: number[] | undefined = data.embedding?.values;
    return Array.isArray(vec) ? vec : null;
  } catch (err) {
    console.error('Embeddings request failed', err);
    return null;
  }
}

// pgvector literal: '[0.1,0.2,...]'
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
