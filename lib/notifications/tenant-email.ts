// Higher-level email helpers on top of the neutral notifications layer.
//
// Two senders, one central Resend account (from the platform's verified domain
// for deliverability):
//   - sendPlatformEmail → from the PLATFORM ("NX iWork"): signup welcome,
//     billing receipts, anything the platform says to a business owner.
//   - sendTenantEmail   → from a TENANT (their brand name + reply-to): order
//     confirmations and other mail a company sends to ITS customers.
//
// Both render a branded, email-client-safe HTML template and degrade to a
// no-op result when the email channel isn't configured (notifyEmail handles it).

import { db } from '@/lib/db';
import { notifyEmail } from './index';
import type { SendResult } from './types';
import { APP_NAME, APP_URL } from '@/lib/env';

export type EmailKind = 'transactional' | 'marketing';

export interface ComposeOptions {
  to: string | string[];
  subject: string;
  /** Big heading inside the card (defaults to the subject). */
  heading?: string;
  /** One or more intro paragraphs (\n-separated). */
  intro?: string;
  /** Optional labelled key/value rows, e.g. an order summary. */
  rows?: Array<{ label: string; value: string }>;
  /** Optional call-to-action button. */
  cta?: { label: string; url: string };
  /** Small print under the button. */
  footnote?: string;
  /** transactional (default) or marketing (gated per-tenant). */
  kind?: EmailKind;
}

/** Send as the platform itself. */
export async function sendPlatformEmail(opts: ComposeOptions): Promise<SendResult> {
  const brand = (process.env.EMAIL_FROM_NAME ?? APP_NAME).trim();
  const html = renderEmail(brand, opts, /* poweredBy */ false);
  return notifyEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    from: composeFrom(brand),
    ...marketingHeaders(opts.kind, undefined),
  });
}

/** Send on behalf of a tenant — their brand name + reply-to, platform domain. */
export async function sendTenantEmail(companyId: string, opts: ComposeOptions): Promise<SendResult> {
  const [settings, company] = await Promise.all([
    db.businessSettings.findUnique({
      where: { companyId },
      select: { emailSenderName: true, emailReplyTo: true, marketingEmailsEnabled: true },
    }),
    db.company.findUnique({ where: { id: companyId }, select: { name: true } }),
  ]);

  const kind = opts.kind ?? 'transactional';
  // Marketing is opt-in per tenant; transactional always sends.
  if (kind === 'marketing' && !settings?.marketingEmailsEnabled) {
    return { ok: false, error: 'marketing_disabled' };
  }

  const brand = settings?.emailSenderName?.trim() || company?.name?.trim() || APP_NAME;
  const replyTo = settings?.emailReplyTo?.trim() || undefined;
  const html = renderEmail(brand, opts, /* poweredBy */ true);

  return notifyEmail({
    to: opts.to,
    subject: opts.subject,
    html,
    from: composeFrom(brand),
    replyTo,
    ...marketingHeaders(kind, replyTo),
  });
}

// ---- internals -------------------------------------------------------------

/** "Display Name <address@domain>" — sanitised. Falls back to provider default. */
function composeFrom(displayName: string): string | undefined {
  const addr = process.env.EMAIL_FROM;
  if (!addr) return undefined;
  const clean = displayName.replace(/[<>"\r\n]/g, '').trim();
  return clean ? `${clean} <${addr}>` : addr;
}

/** List-Unsubscribe for marketing mail (transactional mail must NOT carry it). */
function marketingHeaders(kind: EmailKind | undefined, replyTo?: string) {
  if (kind !== 'marketing') return {};
  const unsub = replyTo ?? process.env.EMAIL_FROM;
  return unsub
    ? { headers: { 'List-Unsubscribe': `<mailto:${unsub}?subject=unsubscribe>` } }
    : {};
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderEmail(brand: string, opts: ComposeOptions, poweredBy: boolean): string {
  const heading = esc(opts.heading ?? opts.subject);
  const intro = (opts.intro ?? '')
    .split('\n')
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6">${esc(p)}</p>`)
    .join('');

  const rows = (opts.rows ?? [])
    .map(
      (r) =>
        `<tr>
           <td style="padding:8px 0;color:#64748b;font-size:13px">${esc(r.label)}</td>
           <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right" dir="ltr">${esc(r.value)}</td>
         </tr>`,
    )
    .join('');
  const rowsBlock = rows
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:8px 0 18px;border-top:1px solid #e2e8f0">${rows}</table>`
    : '';

  const cta = opts.cta
    ? `<div style="margin:22px 0 6px">
         <a href="${esc(opts.cta.url)}" style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 26px;border-radius:10px">${esc(opts.cta.label)}</a>
       </div>`
    : '';

  const footnote = opts.footnote
    ? `<p style="margin:14px 0 0;color:#94a3b8;font-size:12px;line-height:1.5">${esc(opts.footnote)}</p>`
    : '';

  const poweredByLine = poweredBy
    ? `<p style="margin:6px 0 0;color:#cbd5e1;font-size:11px">Powered by <a href="${esc(APP_URL)}" style="color:#94a3b8;text-decoration:none">${esc(APP_NAME)}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;border-collapse:collapse">
    <tr><td style="padding:4px 6px 14px;font-size:15px;font-weight:700;color:#0f172a">${esc(brand)}</td></tr>
    <tr><td style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 26px">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a">${heading}</h1>
      ${intro}
      ${rowsBlock}
      ${cta}
      ${footnote}
    </td></tr>
    <tr><td style="padding:16px 6px 0;color:#94a3b8;font-size:12px">
      <p style="margin:0">${esc(brand)}</p>
      ${poweredByLine}
    </td></tr>
  </table>
</body></html>`;
}
