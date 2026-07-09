import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dispatchEvent } from '@/lib/agent/events';
import { nextRef } from '@/lib/refs';
import { sendTenantEmail } from '@/lib/notifications/tenant-email';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const dynamic = 'force-dynamic';

// Small in-memory rate limiter per visitor/IP (single-instance MVP guard).
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 8;
}

// A visitor places an order from the public landing page. Creates/links a CRM
// customer, records the Order, and fires ORDER_CREATED so a configured agent
// follows up automatically — closing the "customer orders → agent handles" loop.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  const rawEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
  const customerEmail = EMAIL_RE.test(rawEmail) ? rawEmail : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : null;
  const productId = typeof body.productId === 'string' ? body.productId : null;
  const serviceId = typeof body.serviceId === 'string' ? body.serviceId : null;
  const couponCode = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase().slice(0, 40) : '';
  if (!customerName || (!productId && !serviceId)) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(`${slug}:${ip}`)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const company = await db.company.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      settings: { select: { primaryLanguage: true, currencySymbol: true } },
    },
  });
  if (!company || company.status === 'SUSPENDED') {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 404 });
  }

  // Resolve the ordered item + price (scoped to this company).
  let type: 'PRODUCT' | 'SERVICE';
  let title: string;
  let price = 0;
  if (productId) {
    const p = await db.product.findFirst({
      where: { id: productId, companyId: company.id, isActive: true },
      select: { title: true, price: true },
    });
    if (!p) return NextResponse.json({ ok: false, reason: 'item' }, { status: 404 });
    type = 'PRODUCT';
    title = p.title;
    price = Number(p.price);
  } else {
    const s = await db.service.findFirst({
      where: { id: serviceId!, companyId: company.id, isActive: true },
      select: { title: true, price: true },
    });
    if (!s) return NextResponse.json({ ok: false, reason: 'item' }, { status: 404 });
    type = 'SERVICE';
    title = s.title;
    price = s.price ? Number(s.price) : 0;
  }

  // Optional coupon redemption — scope/window/min-subtotal/remaining validated.
  // An invalid code is reported so the customer can fix it rather than overpay.
  let couponId: string | undefined;
  let discount = 0;
  if (couponCode) {
    const coupon = await db.coupon.findFirst({ where: { companyId: company.id, code: couponCode } });
    const nowD = new Date();
    const orderScope = type === 'PRODUCT' ? 'PRODUCTS' : 'SERVICES';
    const valid =
      coupon &&
      coupon.isActive &&
      (!coupon.startsAt || coupon.startsAt <= nowD) &&
      (!coupon.expiresAt || coupon.expiresAt >= nowD) &&
      (coupon.maxRedemptions == null || coupon.usedCount < coupon.maxRedemptions) &&
      (coupon.scope === 'ALL' || coupon.scope === orderScope) &&
      (!coupon.minSubtotal || price >= Number(coupon.minSubtotal));
    if (valid && coupon) {
      discount =
        coupon.type === 'PERCENT'
          ? Math.round(((price * Number(coupon.value)) / 100) * 100) / 100
          : Math.min(price, Number(coupon.value));
      couponId = coupon.id;
    } else {
      return NextResponse.json({ ok: false, reason: 'coupon_invalid' }, { status: 409 });
    }
  }
  const finalTotal = Math.max(0, price - discount);

  // Find-or-create the CRM customer (by phone within the company).
  let customerId: string | undefined;
  if (customerPhone) {
    const existing = await db.customer.findFirst({
      where: { companyId: company.id, phone: customerPhone },
      select: { id: true },
    });
    customerId =
      existing?.id ??
      (await db.customer.create({
        data: { companyId: company.id, ref: await nextRef(company.id, 'customer'), name: customerName, phone: customerPhone, email: customerEmail, status: 'INTERESTED', source: 'public_form' },
        select: { id: true },
      })).id;
  }

  const order = await db.order.create({
    data: {
      companyId: company.id,
      orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
      type,
      customerId,
      customerName,
      customerPhone: customerPhone || null,
      customerEmail,
      customerNotes: notes,
      subtotal: price,
      discount,
      total: finalTotal,
      couponId,
      ...(type === 'SERVICE' ? { serviceId: serviceId! } : {}),
      ...(type === 'PRODUCT'
        ? { items: { create: [{ productId: productId!, quantity: 1, unitPrice: price, total: price }] } }
        : {}),
    },
    select: { id: true, orderNumber: true },
  });
  if (couponId) {
    await db.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
  }

  // A placed order is a realized deal → advance the opportunity to WON
  // (and backfill the email if the customer didn't have one).
  if (customerId) {
    await db.customer.update({
      where: { id: customerId },
      data: { status: 'WON', ...(customerEmail ? { email: customerEmail } : {}) },
    });
  }

  await dispatchEvent(company.id, 'ORDER_CREATED', {
    summary: `طلب جديد ${order.orderNumber}: ${title} — العميل ${customerName}${customerPhone ? ` (${customerPhone})` : ''}`,
    metadata: { orderId: order.id, customerId },
  });

  // Order confirmation to the customer — from the TENANT's brand + reply-to.
  // Localised to the tenant's storefront language. Fire-and-forget; a mail
  // failure must never fail the order (the deal is already recorded).
  if (customerEmail) {
    const ar = (company.settings?.primaryLanguage ?? 'ar') === 'ar';
    const cur = company.settings?.currencySymbol ?? 'SAR';
    void sendTenantEmail(company.id, {
      to: customerEmail,
      subject: ar ? `تأكيد طلبك ${order.orderNumber}` : `Order confirmation ${order.orderNumber}`,
      heading: ar ? `شكراً ${customerName} 🎉` : `Thank you, ${customerName} 🎉`,
      intro: ar
        ? 'تم استلام طلبك بنجاح.\nسيتواصل معك فريقنا قريباً لإتمام التفاصيل.'
        : 'We’ve received your order.\nOur team will reach out shortly to finalize the details.',
      rows: [
        { label: ar ? 'رقم الطلب' : 'Order number', value: order.orderNumber },
        { label: ar ? 'الطلب' : 'Item', value: title },
        { label: ar ? 'الإجمالي' : 'Total', value: `${price} ${cur}` },
      ],
      footnote: ar ? 'هذه رسالة تأكيد آلية.' : 'This is an automated confirmation.',
    }).catch((err) => console.error('[order] confirmation email failed:', err));
  }

  return NextResponse.json({ ok: true, orderNumber: order.orderNumber });
}
