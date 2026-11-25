-- CreateTable
CREATE TABLE "MigrationMarker" (
    "migration" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MigrationMarker_pkey" PRIMARY KEY ("migration","entityType","entityId")
);

-- CreateIndex
CREATE INDEX "MigrationMarker_auditedAt_idx" ON "MigrationMarker"("auditedAt");
