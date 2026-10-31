
-- CreateEnum
CREATE TYPE "CheckExceptionState" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "CheckException" (
    "id" UUID NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "actual" TEXT NOT NULL,
    "toleranceLabel" TEXT NOT NULL,
    "toleranceValue" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "fixBy" "Role" NOT NULL,
    "state" "CheckExceptionState" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CheckException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckException_state_openedAt_idx" ON "CheckException"("state", "openedAt");

-- CreateIndex
CREATE INDEX "CheckException_orderNo_idx" ON "CheckException"("orderNo");

