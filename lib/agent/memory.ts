// Agent long-term memory (the semantic layer).
//
// saveMemory embeds a fact and stores it; recallMemories finds the most
// relevant facts for the current query by vector similarity. AgentMemory.embedding
// is an unsupported (pgvector) column in Prisma, so vector reads/writes use raw
// SQL. Everything degrades gracefully when embeddings aren't configured: facts
// are still stored (without a vector) and recall falls back to importance.

import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { getEmbedding, toVectorLiteral, isEmbeddingsConfigured } from '@/lib/ai/embeddings';

export interface SaveMemoryInput {
  agentId: string;
  companyId: string;
  summary: string;
  importance?: number; // 1-10
  category?: string; // 'customer' | 'product' | 'decision' | 'learning' | ...
}

export async function saveMemory(input: SaveMemoryInput): Promise<void> {
  const { agentId, companyId, summary } = input;
  const importance = Math.min(10, Math.max(1, input.importance ?? 5));
  const category = input.category ?? null;
  const id = randomUUID();

  const vec = await getEmbedding(summary);

  if (vec) {
    const literal = toVectorLiteral(vec);
    await db.$executeRaw`
      INSERT INTO "AgentMemory" ("id", "agentId", "companyId", "summary", "embedding", "importance", "category", "createdAt")
      VALUES (${id}, ${agentId}, ${companyId}, ${summary}, ${literal}::vector, ${importance}, ${category}, now())
    `;
  } else {
    // No embeddings configured — keep the fact anyway (embedding stays null).
    await db.$executeRaw`
      INSERT INTO "AgentMemory" ("id", "agentId", "companyId", "summary", "importance", "category", "createdAt")
      VALUES (${id}, ${agentId}, ${companyId}, ${summary}, ${importance}, ${category}, now())
    `;
  }
}

export interface RecalledMemory {
  summary: string;
  importance: number;
  category: string | null;
}

// Returns the most relevant memories for `query`. With embeddings: cosine
// nearest neighbours. Without: most important + recent.
export async function recallMemories(
  agentId: string,
  companyId: string,
  query: string,
  limit = 5
): Promise<RecalledMemory[]> {
  if (isEmbeddingsConfigured()) {
    const vec = await getEmbedding(query);
    if (vec) {
      const literal = toVectorLiteral(vec);
      return db.$queryRaw<RecalledMemory[]>`
        SELECT "summary", "importance", "category"
        FROM "AgentMemory"
        WHERE "agentId" = ${agentId}
          AND "companyId" = ${companyId}
          AND "embedding" IS NOT NULL
        ORDER BY "embedding" <=> ${literal}::vector
        LIMIT ${limit}
      `;
    }
  }

  // Fallback: importance-ranked recent memories.
  const rows = await db.agentMemory.findMany({
    where: { agentId, companyId },
    orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: { summary: true, importance: true, category: true },
  });
  return rows;
}

// Formats recalled memories as a system-prompt block (empty string when none),
// so the agent "remembers" relevant facts going into a turn.
export async function recallMemoryBlock(
  agentId: string,
  companyId: string,
  query: string
): Promise<string> {
  // Cheap gate: most agents have zero saved memories, so recall would return
  // nothing anyway — skip the (network) embedding round-trip entirely for them.
  const count = await db.agentMemory.count({ where: { agentId, companyId } });
  if (count === 0) return '';
  const memories = await recallMemories(agentId, companyId, query, 5);
  if (memories.length === 0) return '';
  const lines = memories.map((m) => `- ${m.summary}`).join('\n');
  return `ذاكرتك (حقائق مهمة سبق أن حفظتها):\n${lines}`;
}
