-- CreateTable
CREATE TABLE "specialists" (
    "id" TEXT NOT NULL,
    "baby_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "specialists_baby_id_idx" ON "specialists"("baby_id");

-- AddForeignKey
ALTER TABLE "specialists" ADD CONSTRAINT "specialists_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "specialist_id" TEXT;

-- CreateIndex
CREATE INDEX "appointments_specialist_id_idx" ON "appointments"("specialist_id");

-- AddForeignKey
-- ON DELETE SET NULL, never CASCADE: removing a specialist from the address book must not delete
-- the visits they attended, and must not erase `doctor_name`, which stays as written on the day.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
