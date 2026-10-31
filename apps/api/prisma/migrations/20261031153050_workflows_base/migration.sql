-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('prepayment', 'deposit', 'balance', 'full-payment');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('REMINDER', 'ESCALATION', 'INFO');

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "orderRef" TEXT NOT NULL,
    "orderId" UUID,
    "status" TEXT NOT NULL,
    "currentStep" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeRole" "Role" NOT NULL,
    "assigneeUserId" UUID,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "recordNo" TEXT,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorKind" TEXT NOT NULL,
    "actorUserId" UUID,
    "actorName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,
    "idempotencyKey" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowNotification" (
    "id" UUID NOT NULL,
    "instanceId" UUID,
    "taskId" UUID,
    "kind" "NotificationKind" NOT NULL,
    "recipientRole" "Role" NOT NULL,
    "recipientUserId" UUID,
    "orderRef" TEXT,
    "message" TEXT NOT NULL,
    "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
    "escalatesAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfirmation" (
    "id" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "orderRef" TEXT NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "confirmedByUserId" UUID NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRecord" (
    "id" UUID NOT NULL,
    "recordNo" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "navisionNo" TEXT,
    "instanceId" UUID,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkflowRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordCounter" (
    "recordType" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecordCounter_pkey" PRIMARY KEY ("recordType","day")
);

-- CreateTable
CREATE TABLE "DocumentTypeConfig" (
    "documentType" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "updatedByUserId" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DocumentTypeConfig_pkey" PRIMARY KEY ("documentType")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_key_version_key" ON "WorkflowDefinition"("key", "version");

-- CreateIndex
CREATE INDEX "WorkflowInstance_orderRef_idx" ON "WorkflowInstance"("orderRef");

-- CreateIndex
CREATE INDEX "WorkflowInstance_status_updatedAt_idx" ON "WorkflowInstance"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_definitionId_orderRef_key" ON "WorkflowInstance"("definitionId", "orderRef");

-- CreateIndex
CREATE INDEX "WorkflowTask_assigneeRole_status_dueAt_idx" ON "WorkflowTask"("assigneeRole", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowTask_assigneeUserId_status_dueAt_idx" ON "WorkflowTask"("assigneeUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowTask_instanceId_idx" ON "WorkflowTask"("instanceId");

-- CreateIndex
CREATE INDEX "WorkflowTask_status_dueAt_idx" ON "WorkflowTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkflowEvent_instanceId_occurredAt_idx" ON "WorkflowEvent"("instanceId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkflowEvent_type_occurredAt_idx" ON "WorkflowEvent"("type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEvent_instanceId_idempotencyKey_key" ON "WorkflowEvent"("instanceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkflowNotification_recipientRole_readAt_scheduledFor_idx" ON "WorkflowNotification"("recipientRole", "readAt", "scheduledFor");

-- CreateIndex
CREATE INDEX "WorkflowNotification_recipientUserId_readAt_scheduledFor_idx" ON "WorkflowNotification"("recipientUserId", "readAt", "scheduledFor");

-- CreateIndex
CREATE INDEX "WorkflowNotification_sentAt_scheduledFor_idx" ON "WorkflowNotification"("sentAt", "scheduledFor");

-- CreateIndex
CREATE INDEX "WorkflowNotification_instanceId_idx" ON "WorkflowNotification"("instanceId");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_instanceId_idx" ON "PaymentConfirmation"("instanceId");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_orderRef_idx" ON "PaymentConfirmation"("orderRef");

-- CreateIndex
CREATE INDEX "PaymentConfirmation_paymentType_confirmedAt_idx" ON "PaymentConfirmation"("paymentType", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRecord_recordNo_key" ON "WorkflowRecord"("recordNo");

-- CreateIndex
CREATE INDEX "WorkflowRecord_recordType_createdAt_idx" ON "WorkflowRecord"("recordType", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRecord_navisionNo_idx" ON "WorkflowRecord"("navisionNo");

-- CreateIndex
CREATE INDEX "WorkflowRecord_instanceId_idx" ON "WorkflowRecord"("instanceId");

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmation" ADD CONSTRAINT "PaymentConfirmation_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRecord" ADD CONSTRAINT "WorkflowRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
