// Resend email adapter (REST). Used for transactional + marketing email.

import type { EmailMessage, EmailProvider, SendResult } from './types';

const RESEND_API = 'https://api.resend.com/emails';

export function createResendProvider(apiKey: string, defaultFrom: string): EmailProvider {
  return {
    id: 'resend',
    async sendEmail(msg: EmailMessage): Promise<SendResult> {
      if (!msg.html && !msg.text) {
        return { ok: false, error: 'empty_body' };
      }
      try {
        const res = await fetch(RESEND_API, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: msg.from ?? defaultFrom,
            to: Array.isArray(msg.to) ? msg.to : [msg.to],
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            reply_to: msg.replyTo,
          }),
          signal: AbortSignal.timeout(15_000),
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: true, id: data.id };
        }
        const detail = await res.text().catch(() => '');
        return { ok: false, error: detail.slice(0, 200) || 'api_error', status: res.status };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          return { ok: false, error: 'timeout' };
        }
        return { ok: false, error: 'network_error' };
      }
    },
  };
}
