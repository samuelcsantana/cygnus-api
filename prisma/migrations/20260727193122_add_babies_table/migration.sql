-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateTable
CREATE TABLE "babies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "blood_type" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "babies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "babies_user_id_idx" ON "babies"("user_id");

-- AddForeignKey
ALTER TABLE "babies" ADD CONSTRAINT "babies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
