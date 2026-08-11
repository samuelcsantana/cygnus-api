-- CreateEnum
CREATE TYPE "GuardianRole" AS ENUM ('OWNER', 'GUARDIAN');

-- CreateTable
CREATE TABLE "baby_guardians" (
    "id" TEXT NOT NULL,
    "baby_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "GuardianRole" NOT NULL DEFAULT 'GUARDIAN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baby_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baby_invites" (
    "id" TEXT NOT NULL,
    "baby_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "invitee_email" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baby_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "baby_guardians_user_id_idx" ON "baby_guardians"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "baby_guardians_baby_id_user_id_key" ON "baby_guardians"("baby_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "baby_invites_code_key" ON "baby_invites"("code");

-- AddForeignKey
ALTER TABLE "baby_guardians" ADD CONSTRAINT "baby_guardians_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baby_guardians" ADD CONSTRAINT "baby_guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baby_invites" ADD CONSTRAINT "baby_invites_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every pre-existing baby gets an OWNER guardian row for its current `user_id`, so
-- authorization (now driven entirely by `baby_guardians`) doesn't lock out existing owners.
-- `gen_random_uuid()` is built into PostgreSQL core since v13 (no pgcrypto/uuid-ossp extension
-- needed) — this instance runs Postgres 16, confirmed working.
INSERT INTO "baby_guardians" ("id", "baby_id", "user_id", "role", "created_at")
SELECT gen_random_uuid(), "id", "user_id", 'OWNER', "created_at" FROM "babies";
