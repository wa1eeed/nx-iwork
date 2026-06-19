// Twilio SMS adapter (REST). Uses Basic auth (AccountSid:AuthToken) against the
// Messages endpoint — no SDK, so the layer stays light.

import type { SmsMessage, SmsProvider, SendResult } from './types';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Sender: either a Twilio number (+1...) or a Messaging Service SID (MG...). */
  from: string;
}

export function createTwilioProvider(config: TwilioConfig): SmsProvider {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
  const fromIsService = config.from.startsWith('MG');

  return {
    id: 'twilio',
    async sendSms(msg: SmsMessage): Promise<SendResult> {
      const form = new URLSearchParams({ To: msg.to, Body: msg.body });
      // A Messaging Service SID goes in a different field than a phone number.
      form.set(fromIsService ? 'MessagingServiceSid' : 'From', config.from);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Basic ${auth}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
          signal: AbortSignal.timeout(15_000),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) return { ok: true, id: data.sid };
        return {
          ok: false,
          error: data.message ?? 'api_error',
          status: res.status,
        };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          return { ok: false, error: 'timeout' };
        }
        return { ok: false, error: 'network_error' };
      }
    },
  };
}
