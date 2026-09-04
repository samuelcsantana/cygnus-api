-- O profissional passa a pertencer à conta, e o vínculo com criança vira relação própria.
--
-- A ordem importa: `user_id` é preenchido a partir do dono da criança **antes** de virar NOT NULL,
-- e o vínculo atual é copiado para a tabela nova **antes** de `baby_id` ser removida. Nenhuma linha
-- existente perde o profissional nem a criança a que ele atendia.

-- 1. O dono: quem criou a criança é quem passa a ser dono do profissional dela.
ALTER TABLE "specialists" ADD COLUMN "user_id" TEXT;

UPDATE "specialists" AS s
SET "user_id" = b."user_id"
FROM "babies" AS b
WHERE b."id" = s."baby_id";

-- Nenhum órfão é esperado (havia FK para babies), mas um profissional sem dono seria invisível
-- para sempre — melhor falhar a migration do que criar lixo silencioso.
DELETE FROM "specialists" WHERE "user_id" IS NULL;

ALTER TABLE "specialists" ALTER COLUMN "user_id" SET NOT NULL;

-- 2. O vínculo com criança, agora N para N.
CREATE TABLE "specialist_babies" (
    "specialist_id" TEXT NOT NULL,
    "baby_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialist_babies_pkey" PRIMARY KEY ("specialist_id","baby_id")
);

INSERT INTO "specialist_babies" ("specialist_id", "baby_id")
SELECT "id", "baby_id" FROM "specialists";

-- 3. O compartilhamento por nome, para o profissional que não está ligado a criança nenhuma.
CREATE TABLE "specialist_shares" (
    "specialist_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialist_shares_pkey" PRIMARY KEY ("specialist_id","user_id")
);

-- 4. Só depois de copiado, o vínculo antigo sai.
DROP INDEX IF EXISTS "specialists_baby_id_idx";

ALTER TABLE "specialists" DROP CONSTRAINT IF EXISTS "specialists_baby_id_fkey";

ALTER TABLE "specialists" DROP COLUMN "baby_id";

-- 5. Índices e chaves.
CREATE INDEX "specialists_user_id_idx" ON "specialists"("user_id");

CREATE INDEX "specialist_babies_baby_id_idx" ON "specialist_babies"("baby_id");

CREATE INDEX "specialist_shares_user_id_idx" ON "specialist_shares"("user_id");

ALTER TABLE "specialists" ADD CONSTRAINT "specialists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "specialist_babies" ADD CONSTRAINT "specialist_babies_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "specialist_babies" ADD CONSTRAINT "specialist_babies_baby_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "specialist_shares" ADD CONSTRAINT "specialist_shares_specialist_id_fkey" FOREIGN KEY ("specialist_id") REFERENCES "specialists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "specialist_shares" ADD CONSTRAINT "specialist_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
