// WhatsApp Cloud API helpers (official Meta Graph API). Stateless: we send with
// the tenant's access token and receive via one app-level webhook — no persistent
// sessions, so this scales horizontally (Cloud Run / many tenants) unlike QR
// bridges. Never log the token.

import { createHmac, timingSafeEqual } from 'crypto';

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? 'v21.0'}`;

// Validate an access token + phone-number id, returning the display number/name.
export async function whatsappVerifyPhone(
  token: string,
  phoneNumberId: string
): Promise<{ ok: true; displayNumber: string | null; verifiedName: string | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
    );
    const data = (await res.json().catch(() => ({}))) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: data.error?.message ?? `http_${res.status}` };
    return { ok: true, displayNumber: data.display_phone_number ?? null, verifiedName: data.verified_name ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' };
  }
}

// Send a plain-text message. Free-form text is only deliverable inside the 24h
// customer-service window (customer messaged first) — which is exactly our
// inbound-reply model; proactive sends need pre-approved templates (later).
export async function whatsappSendText(
  token: string,
  phoneNumberId: string,
  to: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text.slice(0, 4096) },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error('whatsappSendText non-OK', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    console.error('whatsappSendText failed', err);
    return false;
  }
}

// Verify Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app
// secret) — proves the POST is genuinely from Meta. Constant-time compare.
export function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The inbound webhook shape we consume (a text message from a customer).
export interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from?: string; // the customer's WhatsApp id (phone)
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
}

// Pull the first text message + routing key out of a webhook body.
export function extractWhatsAppMessage(
  body: WhatsAppWebhookBody
): { phoneNumberId: string; from: string; text: string } | null {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const msg = value?.messages?.[0];
      if (phoneNumberId && msg?.from && msg.type === 'text' && msg.text?.body?.trim()) {
        return { phoneNumberId, from: msg.from, text: msg.text.body.trim() };
      }
    }
  }
  return null;
}
