// Billing lifecycle emails (receipt / dunning / ended) — thin wrappers over
// sendPlatformEmail's rows table, addressed to the company owner. All senders
// are fire-and-forget best-effort: billing state never depends on email.

import { db } from '@/lib/db';
import { sendPlatformEmail } from '@/lib/notifications/tenant-email';
import { APP_URL } from '@/lib/env';

// The billing contact = the company's owner (first BUSINESS_OWNER user).
async function ownerEmail(companyId: string): Promise<{ email: string; company: string } | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      users: {
        where: { role: 'BUSINESS_OWNER' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { email: true },
      },
    },
  });
  const email = company?.users[0]?.email;
  return email ? { email, company: company.name } : null;
}

const subscriptionUrl = () => `${APP_URL}/subscription`;

export async function sendRenewalReceipt(
  companyId: string,
  info: { tier: string; amount: number; chargeId: string }
): Promise<void> {
  const to = await ownerEmail(companyId);
  if (!to) return;
  await sendPlatformEmail({
    to: to.email,
    subject: 'Payment received — subscription renewed · تم تجديد اشتراكك',
    heading: 'Subscription renewed · تم التجديد',
    intro: `Thanks! ${to.company}'s subscription was renewed automatically.\nشكراً لك — تم تجديد اشتراك «${to.company}» تلقائياً.`,
    rows: [
      { label: 'Plan · الباقة', value: info.tier },
      { label: 'Amount · المبلغ', value: `${info.amount} SAR` },
      { label: 'Reference · المرجع', value: info.chargeId },
    ],
    cta: { label: 'Manage subscription · إدارة الاشتراك', url: subscriptionUrl() },
    footnote: 'You can turn off auto-renewal anytime from the subscription page.',
  });
}

export async function sendRenewalFailed(
  companyId: string,
  info: { tier: string; attempt: number; maxAttempts: number }
): Promise<void> {
  const to = await ownerEmail(companyId);
  if (!to) return;
  await sendPlatformEmail({
    to: to.email,
    subject: 'Payment failed — action needed · فشل تجديد الاشتراك',
    heading: 'We could not renew your subscription · تعذّر التجديد',
    intro:
      `The renewal charge for ${to.company} failed (attempt ${info.attempt} of ${info.maxAttempts}). We'll retry automatically — or update your card now to keep everything running.\n` +
      `فشلت محاولة تجديد اشتراك «${to.company}» (المحاولة ${info.attempt} من ${info.maxAttempts}). سنعيد المحاولة تلقائياً — أو حدّث بطاقتك الآن لضمان استمرار الخدمة.`,
    rows: [{ label: 'Plan · الباقة', value: info.tier }],
    cta: { label: 'Update payment · تحديث الدفع', url: subscriptionUrl() },
  });
}

export async function sendSubscriptionEnded(companyId: string, info: { tier: string }): Promise<void> {
  const to = await ownerEmail(companyId);
  if (!to) return;
  await sendPlatformEmail({
    to: to.email,
    subject: 'Your subscription has ended · انتهى اشتراكك',
    heading: 'Subscription ended · انتهى الاشتراك',
    intro:
      `After several failed payment attempts, ${to.company} was moved to the free plan. Your data is safe — resubscribe anytime to restore your ${info.tier} features.\n` +
      `بعد عدة محاولات دفع فاشلة، انتقل حساب «${to.company}» إلى الباقة المجانية. بياناتك محفوظة — أعد الاشتراك متى شئت لاستعادة مزايا باقة ${info.tier}.`,
    cta: { label: 'Resubscribe · إعادة الاشتراك', url: subscriptionUrl() },
  });
}
