// Embeddings for semantic memory. Kept separate from the chat provider (BYOK
// Gemini/Claude) because Claude has no embeddings API and embeddings are cheap
// enough to run on one platform-level key. text-embedding-3-small outputs 1536
// dims — matching AgentMemory.embedding's vector(1536) column, so no migration.
//
// Configure with OPENAI_API_KEY. Unset = semantic memory is disabled and the
// memory layer falls back to importance-ranked recall (no vectors).

const OPENAI_EMBEDDINGS = 'https://api.openai.com/v1/embeddings';
const MODEL = process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-small';

export const EMBEDDING_DIMS = 1536;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Returns the embedding vector, or null when embeddings aren't configured or the
// call fails (callers degrade to non-vector behaviour).
export async function getEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(OPENAI_EMBEDDINGS, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: MODEL, input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('Embeddings error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const vec: number[] | undefined = data.data?.[0]?.embedding;
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
