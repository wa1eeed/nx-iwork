// Entry point for notifications. Reads env, returns the active providers (or
// null when a channel isn't configured, so callers degrade gracefully instead
// of throwing). Business code imports getEmailProvider/getSmsProvider/notify*
// from here only.

import { createResendProvider } from './email-resend';
import { createTwilioProvider } from './sms-twilio';
import type { EmailMessage, EmailProvider, SmsMessage, SmsProvider, SendResult } from './types';

export * from './types';

let emailCache: EmailProvider | null | undefined;
let smsCache: SmsProvider | null | undefined;

export function getEmailProvider(): EmailProvider | null {
  if (emailCache !== undefined) return emailCache;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  emailCache = key && from ? createResendProvider(key, from) : null;
  return emailCache;
}

export function getSmsProvider(): SmsProvider | null {
  if (smsCache !== undefined) return smsCache;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  smsCache =
    accountSid && authToken && from
      ? createTwilioProvider({ accountSid, authToken, from })
      : null;
  return smsCache;
}

// Convenience wrappers: a no-op success-shaped result when the channel isn't
// configured, so a flow that "tries to notify" never crashes in dev/staging.
export async function notifyEmail(msg: EmailMessage): Promise<SendResult> {
  const provider = getEmailProvider();
  if (!provider) return { ok: false, error: 'email_not_configured' };
  return provider.sendEmail(msg);
}

export async function notifySms(msg: SmsMessage): Promise<SendResult> {
  const provider = getSmsProvider();
  if (!provider) return { ok: false, error: 'sms_not_configured' };
  return provider.sendSms(msg);
}
