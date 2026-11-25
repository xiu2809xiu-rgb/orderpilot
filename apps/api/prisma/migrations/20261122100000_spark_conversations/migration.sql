-- CreateEnum
CREATE TYPE "SparkMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "SparkMessageStatus" AS ENUM ('OK', 'FAILED', 'STOPPED');

-- CreateTable
CREATE TABLE "SparkConversation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SparkConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparkMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" "SparkMessageRole" NOT NULL,
    "status" "SparkMessageStatus" NOT NULL DEFAULT 'OK',
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "actorRole" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "mock" BOOLEAN,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "finishReason" TEXT,
    "errorCode" TEXT,
    "traceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparkMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SparkConversation_userId_updatedAt_idx" ON "SparkConversation"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SparkMessage_conversationId_seq_key" ON "SparkMessage"("conversationId", "seq");

-- CreateIndex
CREATE INDEX "AiUsageRecord_traceId_idx" ON "AiUsageRecord"("traceId");

-- AddForeignKey
ALTER TABLE "SparkMessage" ADD CONSTRAINT "SparkMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SparkConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
