-- #383, ADR 0067: a notice to the management approvers whenever the
-- administrator's role gains a permission, and who has read it.

-- CreateTable
CREATE TABLE "GovernanceNotice" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "actorUserId" UUID NOT NULL,
    "actorName" TEXT NOT NULL,
    "permissions" TEXT[],
    "fromRole" "Role",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceNoticeRead" (
    "noticeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceNoticeRead_pkey" PRIMARY KEY ("noticeId","userId")
);

-- CreateIndex
CREATE INDEX "GovernanceNotice_createdAt_idx" ON "GovernanceNotice"("createdAt");

-- CreateIndex
CREATE INDEX "GovernanceNoticeRead_userId_idx" ON "GovernanceNoticeRead"("userId");

-- AddForeignKey
ALTER TABLE "GovernanceNoticeRead" ADD CONSTRAINT "GovernanceNoticeRead_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "GovernanceNotice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
