// Customer-facing booking emails — a confirmation when a booking is made (if the
// owner enabled it) and a reminder N hours before the appointment. Both compose
// through sendTenantEmail so they carry the tenant's brand + reply-to, and both
// are transactional (always deliver, no marketing gate). Fire-and-forget at the
// call sites — a mail hiccup must never block a booking.

import { db } from '@/lib/db';
import { sendTenantEmail } from './tenant-email';

export interface BookingEmailData {
  to: string;
  customerName: string;
  serviceTitle: string;
  startAt: Date;
  ref?: string | null;
  waitlisted?: boolean;
}

function formatWhen(startAt: Date, ar: boolean, tz: string): string {
  return new Intl.DateTimeFormat(ar ? 'ar' : 'en', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: tz,
  }).format(startAt);
}

function rows(d: BookingEmailData, ar: boolean, when: string) {
  return [
    { label: ar ? 'الخدمة' : 'Service', value: d.serviceTitle },
    { label: ar ? 'الموعد' : 'When', value: when },
    ...(d.ref ? [{ label: ar ? 'رقم الحجز' : 'Reference', value: d.ref }] : []),
  ];
}

// Sent when a booking is made — gated on the owner's bookingConfirmationEnabled.
export async function sendBookingConfirmation(companyId: string, d: BookingEmailData): Promise<void> {
  if (!d.to) return;
  const settings = await db.businessSettings.findUnique({
    where: { companyId },
    select: { bookingConfirmationEnabled: true, primaryLanguage: true, timezone: true, cancellationPolicy: true },
  });
  if (settings && settings.bookingConfirmationEnabled === false) return; // owner opted out
  const ar = (settings?.primaryLanguage ?? 'ar') === 'ar';
  const when = formatWhen(d.startAt, ar, settings?.timezone || 'Asia/Riyadh');
  const policy = settings?.cancellationPolicy?.trim();
  await sendTenantEmail(companyId, {
    to: d.to,
    subject: (d.waitlisted
      ? ar
        ? `أنت على قائمة الانتظار ${d.ref ?? ''}`
        : `You’re on the waitlist ${d.ref ?? ''}`
      : ar
        ? `تأكيد حجزك ${d.ref ?? ''}`
        : `Booking confirmation ${d.ref ?? ''}`
    ).trim(),
    heading: ar ? `شكراً ${d.customerName} 🗓️` : `Thank you, ${d.customerName} 🗓️`,
    intro: d.waitlisted
      ? ar
        ? 'هذا الموعد ممتلئ، وأضفناك إلى قائمة الانتظار.\nسنتواصل معك فور توفّر مكان.'
        : 'This slot is full, so we added you to the waitlist.\nWe’ll reach out the moment a place opens up.'
      : ar
        ? 'تم استلام حجزك.\nسيتم تأكيده قريباً وستصلك أي تحديثات.'
        : 'We’ve received your booking.\nIt will be confirmed shortly and we’ll keep you posted.',
    rows: rows(d, ar, when),
    footnote: policy
      ? `${ar ? 'سياسة الإلغاء' : 'Cancellation policy'}: ${policy}`
      : ar
        ? 'هذه رسالة تأكيد آلية.'
        : 'This is an automated confirmation.',
  });
}

// Sent by the reminder cron N hours before the appointment. The caller already
// resolved the language/timezone, so this doesn't re-query settings.
export async function sendBookingReminder(
  companyId: string,
  d: BookingEmailData,
  opts: { ar: boolean; tz: string },
): Promise<void> {
  if (!d.to) return;
  const { ar, tz } = opts;
  const when = formatWhen(d.startAt, ar, tz);
  await sendTenantEmail(companyId, {
    to: d.to,
    subject: (ar ? `تذكير بموعدك ${d.ref ?? ''}` : `Reminder: your appointment ${d.ref ?? ''}`).trim(),
    heading: ar ? 'تذكير بموعدك 🔔' : 'Appointment reminder 🔔',
    intro: ar
      ? `مرحباً ${d.customerName}، هذا تذكير بموعدك القادم. نتطلّع لرؤيتك!`
      : `Hi ${d.customerName}, this is a friendly reminder of your upcoming appointment. See you soon!`,
    rows: rows(d, ar, when),
    footnote: ar ? 'إن رغبت بإعادة الجدولة، يسعدنا تواصلك معنا.' : 'Need to reschedule? Just reply to this email.',
  });
}
