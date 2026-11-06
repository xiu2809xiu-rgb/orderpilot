-- AlterTable
ALTER TABLE "WorkflowNotification" ADD COLUMN     "dedupeKey" TEXT;

-- CreateTable
CREATE TABLE "WorkflowTaskSla" (
    "taskKind" TEXT NOT NULL,
    "dueAfterMinutes" INTEGER NOT NULL,
    "remindBeforeMinutes" INTEGER NOT NULL,
    "escalateAfterMinutes" INTEGER NOT NULL,
    "escalateToRole" "Role" NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkflowTaskSla_pkey" PRIMARY KEY ("taskKind")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowNotification_dedupeKey_key" ON "WorkflowNotification"("dedupeKey");
