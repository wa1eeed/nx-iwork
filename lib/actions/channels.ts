'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { encrypt, decrypt } from '@/lib/encryption';
import { APP_URL } from '@/lib/env';
import {
  telegramGetMe,
  telegramSetWebhook,
  telegramDeleteWebhook,
} from '@/lib/channels/telegram';
import { whatsappVerifyPhone } from '@/lib/channels/whatsapp';
import { exchangeCodeForToken, subscribeAppToWaba, registerPhone } from '@/lib/channels/whatsapp-signup';

type Result =
  | { ok: true; botUsername?: string | null }
  | { ok: false; error: string };

async function companyId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

// A channel must route to a CUSTOMER_FACING agent — an internal agent may never
// answer a customer, same hard scope as the website widget.
async function assertCustomerAgent(cid: string, agentId: string): Promise<boolean> {
  const agent = await db.agent.findFirst({
    where: { id: agentId, companyId: cid },
    select: { surface: true, status: true },
  });
  return Boolean(agent && agent.surface === 'CUSTOMER_FACING');
}

// Connect (or reconnect) the company's Telegram bot: validate the token, persist
// it encrypted, and register the webhook so inbound messages reach our route.
export async function connectTelegram(input: { token: string; agentId: string }): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };

  const token = input.token?.trim();
  if (!token) return { ok: false, error: 'token_required' };
  if (!input.agentId || !(await assertCustomerAgent(cid, input.agentId))) {
    return { ok: false, error: 'agent_invalid' };
  }
  if (!APP_URL.startsWith('https://')) return { ok: false, error: 'https_required' };

  const me = await telegramGetMe(token);
  if (!me.ok) return { ok: false, error: 'invalid_token' };

  // Reuse a stable secret across reconnects so the webhook URL doesn't churn.
  const existing = await db.channel.findUnique({
    where: { companyId_type: { companyId: cid, type: 'TELEGRAM' } },
    select: { secret: true },
  });
  const secret = existing?.secret ?? randomBytes(24).toString('hex');

  await db.channel.upsert({
    where: { companyId_type: { companyId: cid, type: 'TELEGRAM' } },
    create: {
      companyId: cid,
      type: 'TELEGRAM',
      token: encrypt(token),
      agentId: input.agentId,
      botUsername: me.username,
      secret,
      isActive: true,
    },
    update: {
      token: encrypt(token),
      agentId: input.agentId,
      botUsername: me.username,
      isActive: true,
    },
  });

  const hook = await telegramSetWebhook(token, `${APP_URL}/api/channels/telegram/${secret}`, secret);
  if (!hook.ok) {
    await db.channel.update({
      where: { companyId_type: { companyId: cid, type: 'TELEGRAM' } },
      data: { isActive: false },
    });
    return { ok: false, error: 'webhook_failed' };
  }

  revalidatePath('/settings');
  return { ok: true, botUsername: me.username };
}

// Change which agent answers on the connected channel (no token re-entry).
export async function setTelegramAgent(agentId: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  if (!(await assertCustomerAgent(cid, agentId))) return { ok: false, error: 'agent_invalid' };
  const channel = await db.channel.findUnique({
    where: { companyId_type: { companyId: cid, type: 'TELEGRAM' } },
    select: { id: true },
  });
  if (!channel) return { ok: false, error: 'not_connected' };
  await db.channel.update({ where: { id: channel.id }, data: { agentId } });
  revalidatePath('/settings');
  return { ok: true };
}

// Disconnect: drop the Telegram webhook (best-effort) and remove the channel.
export async function disconnectTelegram(): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const channel = await db.channel.findUnique({
    where: { companyId_type: { companyId: cid, type: 'TELEGRAM' } },
    select: { id: true, token: true },
  });
  if (!channel) return { ok: true };
  try {
    await telegramDeleteWebhook(decrypt(channel.token));
  } catch {
    // best-effort — remove the row regardless
  }
  await db.channel.delete({ where: { id: channel.id } });
  revalidatePath('/settings');
  return { ok: true };
}

// ── WhatsApp Cloud API ───────────────────────────────────────────────────────
// Manual connect: the owner pastes the access token + phone-number id from their
// Meta app. Stateless — inbound arrives on the shared app webhook, routed by the
// phone-number id we store here. (Embedded Signup is the next onboarding step.)
export async function connectWhatsApp(input: {
  accessToken: string;
  phoneNumberId: string;
  agentId: string;
}): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };

  const accessToken = input.accessToken?.trim();
  const phoneNumberId = input.phoneNumberId?.trim();
  if (!accessToken || !phoneNumberId) return { ok: false, error: 'token_required' };
  if (!input.agentId || !(await assertCustomerAgent(cid, input.agentId))) {
    return { ok: false, error: 'agent_invalid' };
  }

  // A phone-number id maps to exactly one channel (globally unique routing key).
  const owner = await db.channel.findUnique({
    where: { phoneNumberId },
    select: { companyId: true },
  });
  if (owner && owner.companyId !== cid) return { ok: false, error: 'phone_in_use' };

  const verify = await whatsappVerifyPhone(accessToken, phoneNumberId);
  if (!verify.ok) return { ok: false, error: 'invalid_token' };
  const label = verify.verifiedName || verify.displayNumber;

  const existing = await db.channel.findUnique({
    where: { companyId_type: { companyId: cid, type: 'WHATSAPP' } },
    select: { secret: true },
  });
  const secret = existing?.secret ?? randomBytes(24).toString('hex');

  await db.channel.upsert({
    where: { companyId_type: { companyId: cid, type: 'WHATSAPP' } },
    create: {
      companyId: cid,
      type: 'WHATSAPP',
      token: encrypt(accessToken),
      agentId: input.agentId,
      phoneNumberId,
      botUsername: label,
      secret,
      isActive: true,
    },
    update: {
      token: encrypt(accessToken),
      agentId: input.agentId,
      phoneNumberId,
      botUsername: label,
      isActive: true,
    },
  });

  revalidatePath('/settings');
  return { ok: true, botUsername: label };
}

// Complete Embedded Signup: exchange the popup's auth code for a business token,
// wire the WABA to our webhook, register the number, and persist the channel.
export async function completeWhatsAppSignup(input: {
  code: string;
  phoneNumberId: string;
  wabaId: string;
  agentId: string;
}): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };

  const { code, phoneNumberId, wabaId, agentId } = input;
  if (!code || !phoneNumberId) return { ok: false, error: 'token_required' };
  if (!agentId || !(await assertCustomerAgent(cid, agentId))) return { ok: false, error: 'agent_invalid' };

  const owner = await db.channel.findUnique({ where: { phoneNumberId }, select: { companyId: true } });
  if (owner && owner.companyId !== cid) return { ok: false, error: 'phone_in_use' };

  const ex = await exchangeCodeForToken(code);
  if (!ex.ok) return { ok: false, error: 'invalid_token' };

  if (wabaId) await subscribeAppToWaba(ex.token, wabaId); // best-effort
  await registerPhone(ex.token, phoneNumberId); // best-effort
  const verify = await whatsappVerifyPhone(ex.token, phoneNumberId);
  const label = verify.ok ? verify.verifiedName || verify.displayNumber : null;

  const existing = await db.channel.findUnique({
    where: { companyId_type: { companyId: cid, type: 'WHATSAPP' } },
    select: { secret: true },
  });
  const secret = existing?.secret ?? randomBytes(24).toString('hex');

  await db.channel.upsert({
    where: { companyId_type: { companyId: cid, type: 'WHATSAPP' } },
    create: {
      companyId: cid,
      type: 'WHATSAPP',
      token: encrypt(ex.token),
      agentId,
      phoneNumberId,
      wabaId: wabaId || null,
      botUsername: label,
      secret,
      isActive: true,
    },
    update: {
      token: encrypt(ex.token),
      agentId,
      phoneNumberId,
      wabaId: wabaId || null,
      botUsername: label,
      isActive: true,
    },
  });

  revalidatePath('/settings');
  return { ok: true, botUsername: label };
}

export async function setWhatsAppAgent(agentId: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  if (!(await assertCustomerAgent(cid, agentId))) return { ok: false, error: 'agent_invalid' };
  const channel = await db.channel.findUnique({
    where: { companyId_type: { companyId: cid, type: 'WHATSAPP' } },
    select: { id: true },
  });
  if (!channel) return { ok: false, error: 'not_connected' };
  await db.channel.update({ where: { id: channel.id }, data: { agentId } });
  revalidatePath('/settings');
  return { ok: true };
}

export async function disconnectWhatsApp(): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  await db.channel.deleteMany({ where: { companyId: cid, type: 'WHATSAPP' } });
  revalidatePath('/settings');
  return { ok: true };
}
