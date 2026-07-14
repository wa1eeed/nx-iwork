-- MCP servers: per-tenant registry of remote Model Context Protocol servers whose
-- tools are exposed to agents (namespaced mcp__{key}__{tool}) through the same
-- permission gate. Auth token encrypted at rest. Additive; companyId-scoped.

CREATE TABLE "McpServer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "McpServer_companyId_key_key" ON "McpServer"("companyId", "key");
CREATE INDEX "McpServer_companyId_idx" ON "McpServer"("companyId");

ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
