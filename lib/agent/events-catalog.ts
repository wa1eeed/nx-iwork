import type { TriggerEvent } from '@prisma/client';

// Single source of truth for the business events an agent scenario can react to.
// Labels live in the `events.*` message catalog (en/ar). Extend here when a new
// TriggerEvent is added so every scenario UI picks it up automatically.
export const TRIGGER_EVENTS: TriggerEvent[] = [
  'LEAD_CREATED',
  'ORDER_CREATED',
  'ORDER_PAID',
  'CART_ABANDONED',
  'COMPLAINT_RECEIVED',
];

export function isTriggerEvent(v: string): v is TriggerEvent {
  return (TRIGGER_EVENTS as string[]).includes(v);
}
