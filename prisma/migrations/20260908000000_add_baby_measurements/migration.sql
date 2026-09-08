CREATE TABLE "baby_measurements" (
  "id" TEXT NOT NULL,
  "baby_id" TEXT NOT NULL,
  "measured_on" DATE NOT NULL,
  "weight_grams" INTEGER,
  "height_millimeters" INTEGER,
  CONSTRAINT "baby_measurements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "baby_measurements_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "baby_measurements_has_value" CHECK ("weight_grams" IS NOT NULL OR "height_millimeters" IS NOT NULL),
  CONSTRAINT "baby_measurements_weight_range" CHECK ("weight_grams" BETWEEN 100 AND 150000),
  CONSTRAINT "baby_measurements_height_range" CHECK ("height_millimeters" BETWEEN 100 AND 2500)
);
CREATE INDEX "baby_measurements_baby_id_measured_on_idx" ON "baby_measurements"("baby_id", "measured_on");
