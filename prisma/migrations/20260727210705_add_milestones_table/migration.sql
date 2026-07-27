-- CreateEnum
CREATE TYPE "MilestoneCategory" AS ENUM ('MOTOR', 'LANGUAGE', 'SOCIAL', 'COGNITIVE', 'OTHER');

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "baby_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "achieved_at" DATE NOT NULL,
    "category" "MilestoneCategory" NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_baby_id_idx" ON "milestones"("baby_id");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
