-- CreateTable
CREATE TABLE "VendorBankBaseline" (
    "vendorNo" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "sealed" JSONB NOT NULL,
    "setBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VendorBankBaseline_pkey" PRIMARY KEY ("vendorNo","accountCode")
);

-- CreateTable
CREATE TABLE "VendorBankHold" (
    "id" UUID NOT NULL,
    "vendorNo" TEXT NOT NULL,
    "accountCode" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "changedByUserId" UUID,
    "differingFields" TEXT[],
    "beforeMasks" JSONB NOT NULL,
    "proposed" JSONB NOT NULL,
    "proposedDigest" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ(3) NOT NULL,
    "resolution" TEXT,
    "clearedAt" TIMESTAMPTZ(3),
    "clearedByUserId" UUID,
    "clearReason" TEXT,

    CONSTRAINT "VendorBankHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBankHoldVerification" (
    "id" UUID NOT NULL,
    "holdId" UUID NOT NULL,
    "verifiedByUserId" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "contactedAt" TIMESTAMPTZ(3) NOT NULL,
    "contactFromStoredRecord" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VendorBankHoldVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorBankHold_vendorNo_status_openedAt_idx" ON "VendorBankHold"("vendorNo", "status", "openedAt");

-- CreateIndex
CREATE INDEX "VendorBankHold_status_openedAt_idx" ON "VendorBankHold"("status", "openedAt");

-- CreateIndex
CREATE INDEX "VendorBankHoldVerification_holdId_recordedAt_idx" ON "VendorBankHoldVerification"("holdId", "recordedAt");

-- AddForeignKey
ALTER TABLE "VendorBankHoldVerification" ADD CONSTRAINT "VendorBankHoldVerification_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "VendorBankHold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open hold per set of new details, held by the table itself so that no
-- race and no other route can open a second. Prisma cannot express a partial
-- index, and leaves this one alone.
CREATE UNIQUE INDEX "VendorBankHold_one_open_per_details"
  ON "VendorBankHold" ("vendorNo", "proposedDigest")
  WHERE "status" = 'open';
