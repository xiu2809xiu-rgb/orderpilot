-- CreateEnum
CREATE TYPE "ProfilePictureStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ProfilePictureRemoval" AS ENUM ('WITHDRAWN', 'REPLACED_BY_UPLOAD', 'REPLACED_BY_APPROVAL', 'TAKEN_DOWN');

-- CreateEnum
CREATE TYPE "ProfilePictureAiStatus" AS ENUM ('CHECKED', 'NOT_ALLOWED', 'NOT_RUN');

-- CreateEnum
CREATE TYPE "ProfilePictureAiVerdict" AS ENUM ('LOOKS_FINE', 'NEEDS_A_CLOSER_LOOK');

-- CreateTable
CREATE TABLE "ProfilePicture" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "ProfilePictureStatus" NOT NULL DEFAULT 'PENDING',
    "removal" "ProfilePictureRemoval",
    "objectKey" TEXT NOT NULL,
    "objectDeletedAt" TIMESTAMPTZ(3),
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "progressive" BOOLEAN NOT NULL,
    "aiStatus" "ProfilePictureAiStatus" NOT NULL,
    "aiWhy" TEXT,
    "aiVerdict" "ProfilePictureAiVerdict",
    "aiConcerns" TEXT[],
    "aiNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionFamilyId" UUID,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "reasonCode" TEXT,
    "reasonNote" TEXT,
    "removedAt" TIMESTAMPTZ(3),
    "removedById" UUID,

    CONSTRAINT "ProfilePicture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePicture_objectKey_key" ON "ProfilePicture"("objectKey");

-- CreateIndex
CREATE INDEX "ProfilePicture_userId_status_idx" ON "ProfilePicture"("userId", "status");

-- CreateIndex
CREATE INDEX "ProfilePicture_status_createdAt_idx" ON "ProfilePicture"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfilePicture_userId_createdAt_idx" ON "ProfilePicture"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProfilePicture" ADD CONSTRAINT "ProfilePicture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One pending and one approved picture per person, held by the table itself so
-- that no race and no other route can make a second. Prisma cannot express a
-- partial index, and leaves these alone.
CREATE UNIQUE INDEX "ProfilePicture_one_pending_per_user"
  ON "ProfilePicture" ("userId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "ProfilePicture_one_approved_per_user"
  ON "ProfilePicture" ("userId") WHERE "status" = 'APPROVED';

-- The sweep reads only rows whose stored object is still to be deleted.
CREATE INDEX "ProfilePicture_object_left_idx"
  ON "ProfilePicture" ("createdAt")
  WHERE "objectDeletedAt" IS NULL AND "status" IN ('REJECTED', 'REMOVED');

-- The database refuses what the rules refuse.
ALTER TABLE "ProfilePicture"
  ADD CONSTRAINT "ProfilePicture_removal_matches_status"
    CHECK (("status" = 'REMOVED') = ("removal" IS NOT NULL)),
  ADD CONSTRAINT "ProfilePicture_size_in_range"
    CHECK ("byteSize" BETWEEN 1 AND 262144 AND "width" BETWEEN 128 AND 512),
  ADD CONSTRAINT "ProfilePicture_sha256_is_hex"
    CHECK ("sha256" ~ '^[0-9a-f]{64}$');
