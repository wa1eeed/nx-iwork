// Telegram escalation channel. Each company configures its own bot token + chat
// id in settings; this posts a message to that chat. Best-effort: failures are
// logged, never thrown, so escalation never breaks the calling flow.

import { db } from '@/lib/db';

export async function sendTelegram(companyId: string, text: string): Promise<boolean> {
  const settings = await db.businessSettings.findUnique({
    where: { companyId },
    select: { telegramBotToken: true, telegramChatId: true },
  });
  const token = settings?.telegramBotToken?.trim();
  const chatId = settings?.telegramChatId?.trim();
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('sendTelegram non-OK', companyId, res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('sendTelegram failed', companyId, err);
    return false;
  }
}

// Lightweight connectivity test used by the settings UI ("send a test message").
export async function sendTelegramTest(token: string, chatId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ NX iWork escalation channel connected.' }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
