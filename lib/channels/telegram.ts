// Telegram Bot API helpers for the inbound channel. Thin REST wrappers (no SDK),
// all best-effort with a short timeout. The bot token is the caller's decrypted
// secret — never log it.

const API = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

async function call<T = unknown>(
  token: string,
  method: string,
  body: Record<string, unknown>,
  timeoutMs = 10_000
): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const res = await fetch(API(token, method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    return { ok: Boolean(data.ok), result: data.result, description: data.description };
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : 'network_error' };
  }
}

// Validate a token + read the bot identity. Returns the @username on success.
export async function telegramGetMe(
  token: string
): Promise<{ ok: true; username: string | null } | { ok: false; error: string }> {
  const res = await call<{ username?: string }>(token, 'getMe', {});
  if (!res.ok) return { ok: false, error: res.description ?? 'invalid_token' };
  return { ok: true, username: res.result?.username ?? null };
}

// Register the webhook + a secret_token Telegram echoes back on every update
// (our tamper check). `allowed_updates` trims noise to plain messages.
export async function telegramSetWebhook(
  token: string,
  url: string,
  secret: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await call(token, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  return { ok: res.ok, error: res.ok ? undefined : res.description };
}

export async function telegramDeleteWebhook(token: string): Promise<boolean> {
  const res = await call(token, 'deleteWebhook', { drop_pending_updates: false });
  return res.ok;
}

// Telegram caps message text at 4096 chars.
export async function telegramSendMessage(
  token: string,
  chatId: number | string,
  text: string
): Promise<boolean> {
  const res = await call(token, 'sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4096),
    disable_web_page_preview: true,
  });
  return res.ok;
}

// A minimal typing of the inbound update shape we consume.
export interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string; type?: string };
    from?: { id?: number; first_name?: string; username?: string; is_bot?: boolean };
    text?: string;
  };
}
