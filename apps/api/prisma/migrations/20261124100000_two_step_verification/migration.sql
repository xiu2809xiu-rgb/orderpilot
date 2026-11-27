-- CreateEnum
CREATE TYPE "TwoStepStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "TwoStepChannel" AS ENUM ('AUTHENTICATOR');

-- CreateTable
CREATE TABLE "TwoStepSecret" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "TwoStepStatus" NOT NULL,
    "secretCipher" TEXT NOT NULL,
    "lastStep" INTEGER,
    "pendingExpiresAt" TIMESTAMPTZ(3),
    "enabledAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3)[],
    "lockedUntil" TIMESTAMPTZ(3),
    "locksInARow" INTEGER NOT NULL DEFAULT 0,
    "lastLockedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TwoStepSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoStepChallenge" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "channel" "TwoStepChannel" NOT NULL DEFAULT 'AUTHENTICATOR',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "wrongTries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoStepChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwoStepSecret_userId_key" ON "TwoStepSecret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TwoStepChallenge_tokenHash_key" ON "TwoStepChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "TwoStepChallenge_userId_idx" ON "TwoStepChallenge"("userId");

-- CreateIndex
CREATE INDEX "TwoStepChallenge_expiresAt_idx" ON "TwoStepChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_userId_codeHash_key" ON "RecoveryCode"("userId", "codeHash");

-- AddForeignKey
ALTER TABLE "TwoStepSecret" ADD CONSTRAINT "TwoStepSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoStepChallenge" ADD CONSTRAINT "TwoStepChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TwoStepSecret"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TwoStepSecret"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

