-- One live order per customer and PO number (ADR 0047). Prisma cannot declare an
-- expression or a partial index, so it is written here by hand.
ALTER TABLE "SalesOrder" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "SalesOrder_live_customer_po_key"
  ON "SalesOrder" ("customerNo", upper("externalDocumentNo"))
  WHERE "captureState" <> 'VOID';
