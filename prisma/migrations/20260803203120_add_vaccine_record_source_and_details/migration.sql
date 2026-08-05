-- CreateEnum
CREATE TYPE "VaccineRecordSource" AS ENUM ('CATALOG', 'CAMPAIGN', 'CUSTOM');

-- AlterTable
ALTER TABLE "baby_vaccine_records" ADD COLUMN     "batch_number" TEXT,
ADD COLUMN     "custom_dose" TEXT,
ADD COLUMN     "custom_name" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "professional" TEXT,
ADD COLUMN     "source" "VaccineRecordSource" NOT NULL DEFAULT 'CATALOG',
ALTER COLUMN "vaccine_id" DROP NOT NULL;
