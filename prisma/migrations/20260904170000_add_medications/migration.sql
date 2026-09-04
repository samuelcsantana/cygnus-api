-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "baby_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "reason" TEXT,
    "prescriber_name" TEXT,
    "started_on" DATE NOT NULL,
    "ended_on" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medications_baby_id_idx" ON "medications"("baby_id");

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
