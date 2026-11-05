-- CreateTable
CREATE TABLE "ApprovalUserSetup" (
    "userId" UUID NOT NULL,
    "approverId" UUID,
    "salesAmountApprovalLimit" DECIMAL(18,2) NOT NULL,
    "purchaseAmountApprovalLimit" DECIMAL(18,2) NOT NULL,
    "unlimitedSalesApproval" BOOLEAN NOT NULL DEFAULT false,
    "unlimitedPurchaseApproval" BOOLEAN NOT NULL DEFAULT false,
    "substituteUserId" UUID,
    "awayFrom" TIMESTAMPTZ(3),
    "awayUntil" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ApprovalUserSetup_pkey" PRIMARY KEY ("userId")
);

-- The rules no row may break, held by the table itself, so a row written by
-- any route other than ApprovalSetupService (a script, a reseed) is refused
-- too. Prisma cannot express a CHECK, and leaves these alone.
ALTER TABLE "ApprovalUserSetup"
  ADD CONSTRAINT "ApprovalUserSetup_not_own_substitute"
    CHECK ("substituteUserId" IS NULL OR "substituteUserId" <> "userId"),
  ADD CONSTRAINT "ApprovalUserSetup_absence_in_order"
    CHECK ("awayUntil" IS NULL OR ("awayFrom" IS NOT NULL AND "awayUntil" > "awayFrom")),
  ADD CONSTRAINT "ApprovalUserSetup_limits_not_negative"
    CHECK ("salesAmountApprovalLimit" >= 0 AND "purchaseAmountApprovalLimit" >= 0);
