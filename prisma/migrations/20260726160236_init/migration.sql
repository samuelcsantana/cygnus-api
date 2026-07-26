-- CreateTable
CREATE TABLE "infrastructure_checks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "infrastructure_checks_pkey" PRIMARY KEY ("id")
);
