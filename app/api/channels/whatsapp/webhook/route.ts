import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { runPublicAgentChat } from '@/lib/agent/public-chat';
import {
  verifyMetaSignature,
  extractWhatsAppMessage,
  whatsappSendText,
  type WhatsAppWebhookBody,
} from '@/lib/channels/whatsapp';

// ONE app-level webhook for every tenant (Meta's model). We verify the payload is
// really from Meta (HMAC over the raw body), then route by `phone_number_id` to
// the owning Channel. Stateless — no per-connection session — so it scales.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Meta's subscription handshake: echo hub.challenge when the verify token matches.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const raw = await req.text();

  // Reject forgeries. If the app secret isn't configured we can't verify — drop
  // silently with 200 so Meta doesn't retry-storm a misconfigured deployment.
  if (!appSecret) {
    console.error('whatsapp webhook: WHATSAPP_APP_SECRET not set');
    return NextResponse.json({ ok: true });
  }
  if (!verifyMetaSignature(appSecret, raw, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(raw) as WhatsAppWebhookBody;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = extractWhatsAppMessage(body);
  if (!msg) return NextResponse.json({ ok: true }); // status update / non-text

  const channel = await db.channel.findUnique({
    where: { phoneNumberId: msg.phoneNumberId },
    select: { companyId: true, agentId: true, token: true, isActive: true, type: true },
  });
  if (!channel || !channel.isActive || channel.type !== 'WHATSAPP' || !channel.agentId) {
    return NextResponse.json({ ok: true });
  }

  let token: string;
  try {
    token = decrypt(channel.token);
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await runPublicAgentChat({
      companyId: channel.companyId,
      agentId: channel.agentId,
      // Stable per-customer id → conversation history persists. Public surface's
      // hard default-DENY tool allow-list still applies.
      visitorId: `wa:${msg.from}`,
      message: msg.text,
      meta: { referrer: 'whatsapp' },
    });
    const reply = result.ok
      ? result.reply
      : '⚠️ الخدمة غير متاحة حالياً، حاول لاحقاً. / Service temporarily unavailable.';
    await whatsappSendText(token, msg.phoneNumberId, msg.from, reply);
  } catch (err) {
    console.error('whatsapp webhook error', channel.companyId, err);
    await whatsappSendText(token, msg.phoneNumberId, msg.from, '⚠️ حدث خطأ مؤقت. / A temporary error occurred.').catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
