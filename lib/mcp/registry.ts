// Bridges the per-tenant MCP server registry to the agent tool layer: it lists a
// company's remote tools (namespaced, provider-safe) and dispatches namespaced
// calls back to the right server. The agent loop treats these exactly like
// built-in tools — same permission gate, same executeTool entry point.

import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import type { AiTool } from '@/lib/ai';
import { mcpListTools, mcpCallTool } from './client';

const NS = 'mcp__';

export function isMcpTool(name: string): boolean {
  return name.startsWith(NS);
}

// Slugify a server name into a stable, namespace-safe key.
export function mcpKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'server'
  );
}

function safeDecrypt(v: string | null): string | undefined {
  if (!v) return undefined;
  try {
    return decrypt(v);
  } catch {
    return undefined;
  }
}

// Coerce a tool's input schema into an object schema the providers accept.
function sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema && schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
    return schema;
  }
  return { type: 'object', properties: {} };
}

// All active MCP servers' tools for a company, namespaced `mcp__{key}__{tool}` and
// provider-safe. Best-effort: an unreachable server contributes nothing, so it
// never blocks the agent.
export async function getMcpToolsForCompany(companyId: string): Promise<AiTool[]> {
  const servers = await db.mcpServer.findMany({
    where: { companyId, isActive: true },
    select: { key: true, url: true, authToken: true },
  });
  if (servers.length === 0) return [];

  const perServer = await Promise.all(
    servers.map(async (s): Promise<AiTool[]> => {
      const res = await mcpListTools(s.url, safeDecrypt(s.authToken));
      if (!res.ok) return [];
      const out: AiTool[] = [];
      for (const t of res.tools) {
        const name = `${NS}${s.key}__${t.name}`;
        // Provider tool-name limits: [a-zA-Z0-9_-], <= 64 chars. Drop what won't fit
        // (rare) rather than risk a rejected request.
        if (name.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(name)) continue;
        out.push({
          name,
          description: (t.description || t.name).slice(0, 1024),
          parameters: sanitizeSchema(t.inputSchema),
        });
      }
      return out;
    })
  );
  return perServer.flat();
}

// Dispatch a namespaced tool call to its server. Returns the same ok/error JSON
// string shape the built-in executors use.
export async function callMcpTool(
  companyId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const rest = name.slice(NS.length);
  const sep = rest.indexOf('__');
  if (sep < 0) return JSON.stringify({ ok: false, error: 'bad_mcp_tool' });
  const key = rest.slice(0, sep);
  const tool = rest.slice(sep + 2);

  const server = await db.mcpServer.findUnique({
    where: { companyId_key: { companyId, key } },
    select: { url: true, authToken: true, isActive: true },
  });
  if (!server || !server.isActive) return JSON.stringify({ ok: false, error: 'mcp_server_unavailable' });

  const res = await mcpCallTool(server.url, safeDecrypt(server.authToken), tool, args);
  return res.ok ? JSON.stringify({ ok: true, data: res.text }) : JSON.stringify({ ok: false, error: res.error });
}
