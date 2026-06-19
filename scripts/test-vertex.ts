// Live connectivity check for Google Cloud Vertex AI (managed mode).
//
//   npm run test:vertex
//
// Confirms the service account authenticates and that both surfaces work:
//   1) Chat   — gemini via the @google-cloud/vertexai SDK
//   2) Embeddings — gemini-embedding-001 via the Vertex predict endpoint
// Exits non-zero on any failure so it doubles as a deploy smoke test.

import { createVertexProvider, isVertexConfigured } from '@/lib/ai/providers/vertex';
import { getEmbedding, isEmbeddingsConfigured, EMBEDDING_DIMS } from '@/lib/ai/embeddings';

function line(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('— Vertex AI live check —');
  console.log('project:', process.env.GCP_PROJECT_ID, '| location:', process.env.GCP_LOCATION);
  console.log('creds:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log('');

  if (!isVertexConfigured()) {
    line('config', false, 'GCP_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS required');
    process.exit(1);
  }
  line('config', true);

  let failures = 0;

  // 1) Chat
  try {
    const provider = createVertexProvider();
    const res = await provider.complete({
      system: 'You are a connectivity test. Reply with exactly: VERTEX_OK',
      messages: [{ role: 'user', content: 'ping' }],
      tier: 'HAIKU',
      // 2.5 models spend tokens "thinking" first — give room for visible text.
      maxTokens: 256,
      temperature: 0,
    });
    const ok = res.text.toUpperCase().includes('VERTEX_OK') || res.text.length > 0;
    line('chat', ok, `model=${res.model} reply="${res.text.trim().slice(0, 40)}" tokens=${res.usage.inputTokens}+${res.usage.outputTokens}`);
    if (!ok) failures++;
  } catch (err) {
    line('chat', false, err instanceof Error ? err.message : String(err));
    failures++;
  }

  // 2) Embeddings
  try {
    if (!isEmbeddingsConfigured()) {
      line('embeddings', false, 'not configured');
      failures++;
    } else {
      const vec = await getEmbedding('hello from bznss');
      const ok = Array.isArray(vec) && vec.length === EMBEDDING_DIMS;
      line('embeddings', ok, vec ? `dims=${vec.length} (expected ${EMBEDDING_DIMS})` : 'null');
      if (!ok) failures++;
    }
  } catch (err) {
    line('embeddings', false, err instanceof Error ? err.message : String(err));
    failures++;
  }

  console.log('');
  if (failures === 0) {
    console.log('🎉 Vertex AI is reachable and the service account works.');
    process.exit(0);
  }
  console.log(`💥 ${failures} check(s) failed — see messages above.`);
  process.exit(1);
}

main();
