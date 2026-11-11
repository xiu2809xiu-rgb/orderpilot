-- AlterTable
ALTER TABLE "WorkflowCommand" ADD COLUMN     "completedAt" TIMESTAMPTZ(3),
ALTER COLUMN "response" DROP NOT NULL;

-- Every row written before claims existed holds a finished answer.
UPDATE "WorkflowCommand" SET "completedAt" = "createdAt" WHERE "completedAt" IS NULL;
