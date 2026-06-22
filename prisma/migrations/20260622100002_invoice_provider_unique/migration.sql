-- Unique guard so a Tap subscription charge settles exactly once (idempotent
-- webhook/return). NULLs stay distinct, so non-provider invoices are unaffected.
CREATE UNIQUE INDEX "Invoice_providerInvoiceId_key" ON "Invoice"("providerInvoiceId");
