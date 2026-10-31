-- CreateTable
CREATE TABLE "RoleDataScope" (
    "role" "Role" NOT NULL,
    "scope" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoleDataScope_pkey" PRIMARY KEY ("role")
);
