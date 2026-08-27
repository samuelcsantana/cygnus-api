-- Preserve previous catalog rows for historical vaccine records while allowing
-- new official schedule versions to coexist with them.
CREATE TYPE "VaccineRecommendationKind" AS ENUM ('ROUTINE', 'CONDITIONAL', 'RECURRING');

ALTER TABLE "vaccines"
ADD COLUMN "guidance" TEXT,
ADD COLUMN "code" TEXT,
ADD COLUMN "recommendation_kind" "VaccineRecommendationKind" NOT NULL DEFAULT 'ROUTINE',
ADD COLUMN "schedule_version" TEXT NOT NULL DEFAULT 'LEGACY',
ADD COLUMN "effective_from" DATE NOT NULL DEFAULT DATE '1970-01-01',
ADD COLUMN "effective_to" DATE,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

UPDATE "vaccines" SET "code" = 'legacy-' || "id";

ALTER TABLE "vaccines" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "vaccines"
ALTER COLUMN "schedule_version" DROP DEFAULT,
ALTER COLUMN "effective_from" DROP DEFAULT;

DROP INDEX "vaccines_name_dose_number_key";

CREATE UNIQUE INDEX "vaccines_schedule_version_code_key"
ON "vaccines"("schedule_version", "code");

CREATE INDEX "vaccines_is_active_recommended_age_in_months_idx"
ON "vaccines"("is_active", "recommended_age_in_months");
