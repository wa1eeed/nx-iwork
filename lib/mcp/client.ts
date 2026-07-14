// Minimal MCP (Model Context Protocol) client over Streamable HTTP / JSON-RPC.
// Enough to list a remote server's tools and call them — no SDK. Each operation
// runs a fresh initialize → op sequence (stateless-friendly for serverless), is
// tolerant of both JSON and SSE responses, and never throws (returns a result
// union). We never log the auth token.

const PROTOCOL_VERSION = '2024-11-05';
const CLIENT_INFO = { name: 'bznss-one', version: '1.0.0' };
const TIMEOUT_MS = 15_000;

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

type RpcResponse = { id?: unknown; result?: unknown; error?: { message?: string } };

// One JSON-RPC POST. Parses a single JSON body or an SSE stream (picks the frame
// whose id matches). Returns the result + any server session id header.
async function rpc(
  url: string,
  authToken: string | undefined,
  method: string,
  params: Record<string, unknown>,
  id: number,
  sessionId?: string
): Promise<{ ok: true; result: unknown; sessionId?: string } | { ok: false; error: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  if (sessionId) headers['mcp-session-id'] = sessionId;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' };
  }

  const newSession = res.headers.get('mcp-session-id') ?? sessionId;
  if (!res.ok) return { ok: false, error: `http_${res.status}` };

  const ct = res.headers.get('content-type') ?? '';
  const text = await res.text().catch(() => '');
  let msg: RpcResponse | null = null;

  if (ct.includes('text/event-stream')) {
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      try {
        const obj = JSON.parse(t.slice(5).trim()) as RpcResponse;
        if (obj && obj.id === id) msg = obj;
      } catch {
        // skip non-JSON frames
      }
    }
  } else {
    try {
      msg = JSON.parse(text) as RpcResponse;
    } catch {
      return { ok: false, error: 'bad_json' };
    }
  }

  if (!msg) return { ok: false, error: 'no_response' };
  if (msg.error) return { ok: false, error: msg.error.message ?? 'rpc_error' };
  return { ok: true, result: msg.result, sessionId: newSession ?? undefined };
}

// Fire-and-forget the initialized notification some servers expect post-handshake.
async function notifyInitialized(url: string, authToken: string | undefined, sessionId?: string): Promise<void> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  if (sessionId) headers['mcp-session-id'] = sessionId;
  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // best-effort
  }
}

async function handshake(url: string, authToken: string | undefined) {
  const init = await rpc(
    url,
    authToken,
    'initialize',
    { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    1
  );
  if (init.ok) await notifyInitialized(url, authToken, init.sessionId);
  return init;
}

// List the server's tools.
export async function mcpListTools(
  url: string,
  authToken?: string
): Promise<{ ok: true; tools: McpToolDef[] } | { ok: false; error: string }> {
  const init = await handshake(url, authToken);
  if (!init.ok) return { ok: false, error: init.error };
  const list = await rpc(url, authToken, 'tools/list', {}, 2, init.sessionId);
  if (!list.ok) return { ok: false, error: list.error };
  const raw = (list.result as { tools?: unknown })?.tools;
  const tools: McpToolDef[] = Array.isArray(raw)
    ? raw
        .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
        .map((t) => ({
          name: String(t.name ?? ''),
          description: typeof t.description === 'string' ? t.description : '',
          inputSchema:
            t.inputSchema && typeof t.inputSchema === 'object'
              ? (t.inputSchema as Record<string, unknown>)
              : { type: 'object', properties: {} },
        }))
        .filter((t) => t.name)
    : [];
  return { ok: true, tools };
}

// Call one tool; returns its text content.
export async function mcpCallTool(
  url: string,
  authToken: string | undefined,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const init = await handshake(url, authToken);
  if (!init.ok) return { ok: false, error: init.error };
  const call = await rpc(url, authToken, 'tools/call', { name: toolName, arguments: args }, 3, init.sessionId);
  if (!call.ok) return { ok: false, error: call.error };
  const content = (call.result as { content?: unknown })?.content;
  const text = Array.isArray(content)
    ? content
        .filter((c): c is { type?: string; text?: string } => Boolean(c) && typeof c === 'object')
        .filter((c) => c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text)
        .join('\n')
    : '';
  return { ok: true, text: (text || JSON.stringify(call.result ?? {})).slice(0, 4000) };
}
