-- Upgrade the semantic-memory vector index from ivfflat -> HNSW (cosine).
-- HNSW needs no training and gives better recall/latency at this scale.
DROP INDEX IF EXISTS "AgentMemory_embedding_idx";
CREATE INDEX IF NOT EXISTS "AgentMemory_embedding_hnsw"
ON "AgentMemory"
USING hnsw ("embedding" vector_cosine_ops);
