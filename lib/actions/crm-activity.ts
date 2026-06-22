'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

export type CrmActivityResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'invalid' | 'generic' };

function orderNumber(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

async function context() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  return { userId: session?.user?.id ?? null, companyId };
}

async function ownsCustomer(companyId: string, customerId: string): Promise<boolean> {
  const c = await db.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  return Boolean(c);
}

// A manual note or a logged visit on the opportunity.
export async function addCustomerNote(
  customerId: string,
  type: 'NOTE' | 'VISIT',
  body: string
): Promise<CrmActivityResult> {
  const { userId, companyId } = await context();
  if (!companyId) return { ok: false, error: 'unauthorized' };
  const text = body.trim();
  if (!text || (type !== 'NOTE' && type !== 'VISIT')) return { ok: false, error: 'invalid' };
  if (!(await ownsCustomer(companyId, customerId))) return { ok: false, error: 'not_found' };
  try {
    await db.customerNote.create({
      data: { companyId, customerId, type, body: text.slice(0, 4000), authorId: userId },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (err) {
    console.error('addCustomerNote failed', err);
    return { ok: false, error: 'generic' };
  }
}

// A reminder — a Task (kind REMINDER) so it flows into the calendar + alerts.
export async function addCustomerReminder(
  customerId: string,
  title: string,
  dueAt: string
): Promise<CrmActivityResult> {
  const { companyId } = await context();
  if (!companyId) return { ok: false, error: 'unauthorized' };
  const t = title.trim();
  const when = new Date(dueAt);
  if (!t || Number.isNaN(when.getTime())) return { ok: false, error: 'invalid' };
  if (!(await ownsCustomer(companyId, customerId))) return { ok: false, error: 'not_found' };
  try {
    await db.task.create({
      data: {
        companyId,
        customerId,
        kind: 'REMINDER',
        title: t.slice(0, 200),
        description: t.slice(0, 200),
        triggerType: 'USER_MESSAGE',
        dueAt: when,
        status: 'PENDING',
      },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (err) {
    console.error('addCustomerReminder failed', err);
    return { ok: false, error: 'generic' };
  }
}

// A meeting — a Task (kind APPOINTMENT) with a calendar window.
export async function addCustomerMeeting(
  customerId: string,
  title: string,
  startAt: string,
  endAt?: string | null
): Promise<CrmActivityResult> {
  const { companyId } = await context();
  if (!companyId) return { ok: false, error: 'unauthorized' };
  const t = title.trim();
  const start = new Date(startAt);
  if (!t || Number.isNaN(start.getTime())) return { ok: false, error: 'invalid' };
  const end = endAt ? new Date(endAt) : null;
  if (!(await ownsCustomer(companyId, customerId))) return { ok: false, error: 'not_found' };
  try {
    await db.task.create({
      data: {
        companyId,
        customerId,
        kind: 'APPOINTMENT',
        title: t.slice(0, 200),
        description: t.slice(0, 200),
        triggerType: 'USER_MESSAGE',
        startAt: start,
        endAt: end && !Number.isNaN(end.getTime()) ? end : null,
        status: 'PENDING',
      },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (err) {
    console.error('addCustomerMeeting failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Convert a won opportunity into a linked order, and mark the opportunity WON.
export async function convertOpportunityToOrder(customerId: string): Promise<CrmActivityResult> {
  const { companyId } = await context();
  if (!companyId) return { ok: false, error: 'unauthorized' };
  const customer = await db.customer.findFirst({
    where: { id: customerId, companyId },
    select: { name: true, phone: true, email: true },
  });
  if (!customer) return { ok: false, error: 'not_found' };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { hasEcommerce: true, hasServices: true },
  });
  const type = company && !company.hasEcommerce && company.hasServices ? 'SERVICE' : 'PRODUCT';

  try {
    const order = await db.order.create({
      data: {
        companyId,
        orderNumber: orderNumber(),
        type,
        customerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        status: 'NEW',
      },
      select: { id: true },
    });
    await db.customer.update({ where: { id: customerId }, data: { status: 'WON' } });
    revalidatePath(`/customers/${customerId}`);
    revalidatePath('/orders');
    return { ok: true, id: order.id };
  } catch (err) {
    console.error('convertOpportunityToOrder failed', err);
    return { ok: false, error: 'generic' };
  }
}
