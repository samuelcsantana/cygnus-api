CREATE TABLE "google_identities" (
  "subject" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "google_identities_pkey" PRIMARY KEY ("subject"),
  CONSTRAINT "google_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "google_identities_user_id_key" ON "google_identities"("user_id");
