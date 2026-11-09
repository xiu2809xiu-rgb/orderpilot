-- CreateTable
CREATE TABLE "WorkflowCommand" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowCommand_createdAt_idx" ON "WorkflowCommand"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowCommand_actorUserId_key_key" ON "WorkflowCommand"("actorUserId", "key");
