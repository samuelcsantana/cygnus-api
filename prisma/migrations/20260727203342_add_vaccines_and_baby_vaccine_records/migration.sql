-- CreateEnum
CREATE TYPE "VaccineRecordStatus" AS ENUM ('PENDING', 'APPLIED', 'DELAYED');

-- CreateTable
CREATE TABLE "vaccines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommended_age_in_months" INTEGER NOT NULL,
    "dose_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baby_vaccine_records" (
    "id" TEXT NOT NULL,
    "baby_id" TEXT NOT NULL,
    "vaccine_id" TEXT NOT NULL,
    "status" "VaccineRecordStatus" NOT NULL,
    "application_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baby_vaccine_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vaccines_name_dose_number_key" ON "vaccines"("name", "dose_number");

-- CreateIndex
CREATE UNIQUE INDEX "baby_vaccine_records_baby_id_vaccine_id_key" ON "baby_vaccine_records"("baby_id", "vaccine_id");

-- AddForeignKey
ALTER TABLE "baby_vaccine_records" ADD CONSTRAINT "baby_vaccine_records_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baby_vaccine_records" ADD CONSTRAINT "baby_vaccine_records_vaccine_id_fkey" FOREIGN KEY ("vaccine_id") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
