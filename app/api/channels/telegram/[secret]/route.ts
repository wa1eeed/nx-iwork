import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { runPublicAgentChat } from '@/lib/agent/public-chat';
import { telegramSendMessage, type TelegramUpdate } from '@/lib/channels/telegram';

// Telegram calls this on every inbound message. The `secret` path segment
// identifies the channel AND (together with the `X-Telegram-Bot-Api-Secret-Token`
// header Telegram echoes back) proves the call is really from Telegram. We ALWAYS
// return 200 so Telegram never retry-storms on our own config/errors.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ok = () => NextResponse.json({ ok: true });

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  const channel = await db.channel.findUnique({
    where: { secret },
    select: { companyId: true, agentId: true, token: true, isActive: true, type: true },
  });
  if (!channel || !channel.isActive || channel.type !== 'TELEGRAM' || !channel.agentId) return ok();

  // Tamper check: only Telegram knows the secret_token we registered.
  if (req.headers.get('x-telegram-bot-api-secret-token') !== secret) return ok();

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return ok();
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text?.trim();
  // Only plain text from real users in a private chat.
  if (!chatId || !text || msg?.from?.is_bot) return ok();

  let token: string;
  try {
    token = decrypt(channel.token);
  } catch {
    return ok(); // key rotated → owner must reconnect
  }

  try {
    const result = await runPublicAgentChat({
      companyId: channel.companyId,
      agentId: channel.agentId,
      // Stable per-Telegram-chat visitor id → conversation history persists, and
      // the public-chat surface's hard default-DENY tool allow-list still applies.
      visitorId: `tg:${chatId}`,
      message: text,
      meta: { referrer: 'telegram' },
    });
    const reply = result.ok
      ? result.reply
      : '⚠️ الخدمة غير متاحة حالياً، حاول لاحقاً. / Service temporarily unavailable.';
    await telegramSendMessage(token, chatId, reply);
  } catch (err) {
    console.error('telegram webhook error', channel.companyId, err);
    await telegramSendMessage(token, chatId, '⚠️ حدث خطأ مؤقت. / A temporary error occurred.').catch(() => {});
  }

  return ok();
}
