-- Add the SUBSCRIPTION wallet-transaction type (paying a plan from the wallet).
-- Isolated migration: enum values added here aren't used until a later tx.
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION';
