// Provider-agnostic notifications layer.
//
// Same philosophy as lib/ai/ and lib/storage/: business code (auth, agents,
// billing) sends through these neutral interfaces and never imports a vendor
// SDK. Email is Resend, SMS is Twilio today; swapping either is one new file.
//
// Both adapters call the providers' REST APIs over fetch (no SDK), so the layer
// stays light and runs the same in any runtime.

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /** Overrides the default from address. */
  from?: string;
  replyTo?: string;
  /** Extra SMTP headers, e.g. List-Unsubscribe for marketing mail. */
  headers?: Record<string, string>;
}

export interface SmsMessage {
  /** E.164 number, e.g. +9665XXXXXXXX. */
  to: string;
  body: string;
}

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; status?: number };

export interface EmailProvider {
  readonly id: string;
  sendEmail(msg: EmailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly id: string;
  sendSms(msg: SmsMessage): Promise<SendResult>;
}
