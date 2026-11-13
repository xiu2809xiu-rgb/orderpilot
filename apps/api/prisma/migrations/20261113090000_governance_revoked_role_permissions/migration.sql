-- CreateTable
CREATE TABLE "RevokedRolePermission" (
    "role" "Role" NOT NULL,
    "permission" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedRolePermission_pkey" PRIMARY KEY ("role","permission")
);
