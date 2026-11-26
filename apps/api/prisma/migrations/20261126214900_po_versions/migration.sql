-- PO versions (ADR 0074). The head order row stays the current version. A
-- version that a later one replaces is copied out here, once, and never
-- changed: the copy is the record that the order moved.

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "poVersionNo" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "SalesOrderPoVersion" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "poVersionNo" INTEGER NOT NULL,
    "orderDate" DATE NOT NULL,
    "shipmentDate" DATE,
    "currencyCode" TEXT NOT NULL,
    "prepaymentPercent" DECIMAL(5,2) NOT NULL,
    "supersededAt" TIMESTAMPTZ(3) NOT NULL,
    "supersededBy" UUID NOT NULL,

    CONSTRAINT "SalesOrderPoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderPoVersionLine" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "qtyToShip" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "SalesOrderPoVersionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderPoVersion_orderId_poVersionNo_key" ON "SalesOrderPoVersion"("orderId", "poVersionNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderPoVersionLine_versionId_lineNo_key" ON "SalesOrderPoVersionLine"("versionId", "lineNo");

-- AddForeignKey
ALTER TABLE "SalesOrderPoVersion" ADD CONSTRAINT "SalesOrderPoVersion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderPoVersionLine" ADD CONSTRAINT "SalesOrderPoVersionLine_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SalesOrderPoVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot declare a CHECK, so these two are written by hand. A PO
-- version starts at 1, on the order and on its copy.
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_poVersionNo_check" CHECK ("poVersionNo" >= 1);
ALTER TABLE "SalesOrderPoVersion" ADD CONSTRAINT "SalesOrderPoVersion_poVersionNo_check" CHECK ("poVersionNo" >= 1);

-- Insert-only, by the audit trail's pattern but row-level only: the test
-- harness empties every table with TRUNCATE (test/support/reset.ts), and a
-- statement trigger would stop it. The orders themselves are not guarded
-- against TRUNCATE either, and the foreign keys refuse a DELETE of an order
-- that has a copy. A trigger stops mistakes, not the owner of the table
-- (ADR 0074 decision 3).
CREATE FUNCTION "po_version_refuse_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is insert-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "SalesOrderPoVersion_refuse_update_delete"
  BEFORE UPDATE OR DELETE ON "SalesOrderPoVersion"
  FOR EACH ROW EXECUTE FUNCTION "po_version_refuse_change"();

CREATE TRIGGER "SalesOrderPoVersionLine_refuse_update_delete"
  BEFORE UPDATE OR DELETE ON "SalesOrderPoVersionLine"
  FOR EACH ROW EXECUTE FUNCTION "po_version_refuse_change"();

-- At commit, the copies of an order are exactly versions 1 to poVersionNo - 1.
-- Only the revise move satisfies this, so a later writer that bumps the number
-- or adds a copy alone fails at COMMIT. The message holds no price.
CREATE FUNCTION "po_version_check_copies"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  head_id uuid;
  head_no integer;
  copies integer;
  highest integer;
BEGIN
  IF TG_TABLE_NAME = 'SalesOrder' THEN
    head_id := NEW."id";
  ELSE
    head_id := NEW."orderId";
  END IF;
  SELECT "poVersionNo" INTO head_no FROM "SalesOrder" WHERE "id" = head_id;
  IF head_no IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT count(*), coalesce(max("poVersionNo"), 0) INTO copies, highest
    FROM "SalesOrderPoVersion" WHERE "orderId" = head_id;
  IF copies <> head_no - 1 OR highest <> head_no - 1 THEN
    RAISE EXCEPTION 'order % is at PO version % but holds % earlier copies, the highest %',
      head_id, head_no, copies, highest
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "SalesOrder_po_versions_match"
  AFTER UPDATE OF "poVersionNo" ON "SalesOrder"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "po_version_check_copies"();

CREATE CONSTRAINT TRIGGER "SalesOrderPoVersion_match_head"
  AFTER INSERT ON "SalesOrderPoVersion"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "po_version_check_copies"();
