-- AlterTable
ALTER TABLE "AiUsageRecord" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "classification" TEXT,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "reasonCode" TEXT;

-- CreateIndex
CREATE INDEX "AiUsageRecord_documentId_idx" ON "AiUsageRecord"("documentId");
