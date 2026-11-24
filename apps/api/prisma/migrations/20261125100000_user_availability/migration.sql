-- CreateEnum
CREATE TYPE "UserAvailabilityState" AS ENUM ('FOCUSING', 'DO_NOT_DISTURB');

-- CreateTable
CREATE TABLE "UserAvailability" (
    "userId" UUID NOT NULL,
    "state" "UserAvailabilityState" NOT NULL,
    "setAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserAvailability_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "UserAvailability_setAt_idx" ON "UserAvailability"("setAt");

-- AddForeignKey
ALTER TABLE "UserAvailability" ADD CONSTRAINT "UserAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

