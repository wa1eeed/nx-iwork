// WhatsApp Embedded Signup — the server half of one-click onboarding. The client
// runs Meta's Embedded Signup popup (Facebook JS SDK) and returns an auth `code`
// plus the new phone-number/WABA ids; we exchange the code for a business token,
// subscribe our app to the customer's WABA, and register the number for sending.
//
// Live use requires the platform to be an approved Meta Tech Provider (business
// verification + app review) with an Embedded Signup config. Until then, the
// manual-connect path (paste token + phone-number id) is the fallback.

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? 'v21.0'}`;

// Exchange the Embedded Signup authorization code for a business access token.
export async function exchangeCodeForToken(
  code: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const appId = process.env.FACEBOOK_APP_ID ?? process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) return { ok: false, error: 'signup_not_configured' };
  try {
    const url = new URL(`${GRAPH}/oauth/access_token`);
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('code', code);
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.access_token) return { ok: false, error: data.error?.message ?? `http_${res.status}` };
    return { ok: true, token: data.access_token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' };
  }
}

// Subscribe our app to the customer's WhatsApp Business Account so its inbound
// messages are delivered to our app-level webhook.
export async function subscribeAppToWaba(token: string, wabaId: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Register the phone number for Cloud API sending. Best-effort + idempotent —
// Embedded-Signup numbers are often already registered, so a failure here does
// not block the connection.
export async function registerPhone(token: string, phoneNumberId: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin: process.env.WHATSAPP_REGISTER_PIN ?? '000000' }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
