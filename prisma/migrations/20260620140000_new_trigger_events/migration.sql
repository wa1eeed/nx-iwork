-- New automation events: cart abandonment and customer complaints (with
-- sentiment-based escalation handled in the dispatcher).
ALTER TYPE "TriggerEvent" ADD VALUE IF NOT EXISTS 'CART_ABANDONED';
ALTER TYPE "TriggerEvent" ADD VALUE IF NOT EXISTS 'COMPLAINT_RECEIVED';
