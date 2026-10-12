-- AlterTable
ALTER TABLE "users" ADD COLUMN     "demo_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_demo_expires_at_idx" ON "users"("demo_expires_at");
