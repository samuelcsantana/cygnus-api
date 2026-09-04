-- Renomeia o tipo e a coluna, e torna o valor opcional.
--
-- RENAME preserva os dados: nenhuma linha existente perde o sexo já informado. O DROP NOT NULL é o
-- que permite "prefiro não informar" — que é ausência de valor, e não um terceiro valor de enum:
-- duas formas de dizer a mesma coisa no mesmo campo é o começo de uma consulta errada.
ALTER TYPE "Gender" RENAME TO "SexAtBirth";

ALTER TABLE "babies" RENAME COLUMN "gender" TO "sex_at_birth";

ALTER TABLE "babies" ALTER COLUMN "sex_at_birth" DROP NOT NULL;
