// Embeddings for semantic memory — via Google Cloud Vertex AI, authenticated
// with the platform Service Account (Application Default Credentials). No AI
// Studio API key: the whole AI surface (chat + embeddings) goes through Vertex.
//
// Model gemini-embedding-001 supports outputDimensionality, so we request 1536
// to match AgentMemory.embedding's vector(1536) column — no migration. Cosine
// distance (pgvector `<=>`) is scale-invariant, so reduced-dim vectors rank
// correctly without manual normalisation.
//
// Configured by GCP_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS (+ GCP_LOCATION).
// Unconfigured → semantic memory disabled; recall falls back to importance.

import { GoogleAuth } from 'google-auth-library';
import { getGcpCredentials, isGcpConfigured } from './gcp-auth';

const MODEL = process.env.VERTEX_EMBEDDINGS_MODEL ?? 'gemini-embedding-001';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export const EMBEDDING_DIMS = 1536;

// One GoogleAuth client per process; it caches/refreshes the access token.
// Uses inline env credentials when present, else ADC (mounted JSON).
let auth: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (!auth) {
    const credentials = getGcpCredentials();
    auth = new GoogleAuth({ scopes: SCOPE, ...(credentials ? { credentials } : {}) });
  }
  return auth;
}

export function isEmbeddingsConfigured(): boolean {
  return isGcpConfigured();
}

// Returns the embedding vector, or null when embeddings aren't configured or the
// call fails (callers degrade to non-vector behaviour).
export async function getEmbedding(text: string): Promise<number[] | null> {
  const project = process.env.GCP_PROJECT_ID;
  if (!project) return null;
  const location = process.env.GCP_LOCATION ?? 'us-central1';

  try {
    const token = await getAuth().getAccessToken();
    if (!token) return null;

    const url =
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
      `/locations/${location}/publishers/google/models/${MODEL}:predict`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ content: text.slice(0, 8000) }],
        parameters: { outputDimensionality: EMBEDDING_DIMS },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('Vertex embeddings error', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const vec: number[] | undefined = data.predictions?.[0]?.embeddings?.values;
    return Array.isArray(vec) ? vec : null;
  } catch (err) {
    console.error('Vertex embeddings request failed', err);
    return null;
  }
}

// pgvector literal: '[0.1,0.2,...]'
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
