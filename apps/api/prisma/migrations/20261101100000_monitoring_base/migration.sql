-- CreateTable
CREATE TABLE "AiUsageRecord" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(14,4) NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "userId" UUID,
    "traceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickstreamEvent" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "route" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickstreamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageRecord_occurredAt_idx" ON "AiUsageRecord"("occurredAt");

-- CreateIndex
CREATE INDEX "AiUsageRecord_feature_idx" ON "AiUsageRecord"("feature");

-- CreateIndex
CREATE INDEX "ClickstreamEvent_occurredAt_idx" ON "ClickstreamEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "ClickstreamEvent_route_name_idx" ON "ClickstreamEvent"("route", "name");
