-- Waitlist bookings: a full slot the customer joined a waitlist for. Additive
-- enum value; WAITLIST is NOT an active status, so it never holds slot capacity.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'WAITLIST';
