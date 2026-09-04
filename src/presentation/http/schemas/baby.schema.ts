import { z } from 'zod';

const sexAtBirthSchema = z.enum(['MALE', 'FEMALE']);
const bloodTypeSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const avatarColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value like #2A9D8F')
  .describe("Hex color used as the avatar's border, e.g. #2A9D8F");

export const babyParamsSchema = z.object({
  babyId: z.string().uuid(),
});

export const createBabyBodySchema = z.object({
  name: z.string().min(1).describe("The baby's full name"),
  birthDate: dateOnlySchema.describe('Date of birth, formatted as YYYY-MM-DD. Cannot be in the future'),
  sexAtBirth: sexAtBirthSchema
    .optional()
    .describe('Sex at birth, a clinical variable. Optional: absent means not informed'),
  /**
   * @deprecated Ponte de compatibilidade, e temporária.
   *
   * O front que está em produção no momento deste deploy ainda manda e lê `gender`. Sem aceitá-lo
   * aqui, o primeiro cadastro feito entre o deploy da API e o do front perderia o valor em
   * silêncio. Sai assim que o front novo estiver no ar.
   */
  gender: sexAtBirthSchema.optional(),
  bloodType: bloodTypeSchema.optional(),
  allergies: z.array(z.string().min(1)).optional().describe('Known allergies, e.g. lactose, penicillin'),
  healthPlanName: z.string().min(1).optional().describe('Health insurance plan, e.g. Unimed'),
  healthPlanNumber: z
    .string()
    .min(1)
    .optional()
    .describe('Member number printed on the insurance card — what a clinic desk asks for'),
  avatarUrl: z.string().url().optional(),
  avatarColor: avatarColorSchema.optional(),
});

export const updateBabyBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    birthDate: dateOnlySchema.optional(),
    sexAtBirth: sexAtBirthSchema.nullable().optional(),
    /** @deprecated Mesma ponte do `create`. */
    gender: sexAtBirthSchema.nullable().optional(),
    bloodType: bloodTypeSchema.nullable().optional(),
    allergies: z.array(z.string().min(1)).optional(),
    healthPlanName: z.string().min(1).nullable().optional(),
    healthPlanNumber: z.string().min(1).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    avatarColor: avatarColorSchema.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const babyResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    name: z.string(),
    birthDate: dateOnlySchema,
    sexAtBirth: sexAtBirthSchema.nullable(),
    /**
     * @deprecated Espelho de `sexAtBirth`, mantido por uma versão.
     *
     * É esta linha que impede uma queda: o front em produção exige `gender` na resposta e falha o
     * parse sem ele — o que derrubaria toda tela que carrega crianças no intervalo entre os dois
     * deploys. Remover junto com o `gender` de entrada.
     */
    gender: sexAtBirthSchema.nullable(),
    bloodType: z.string().nullable(),
    allergies: z.array(z.string()),
    healthPlanName: z.string().nullable(),
    healthPlanNumber: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    avatarColor: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('A baby profile owned by the authenticated user');

export const babyListResponseSchema = z.array(babyResponseSchema);

export type CreateBabyBody = z.infer<typeof createBabyBodySchema>;
export type UpdateBabyBody = z.infer<typeof updateBabyBodySchema>;
export type BabyParams = z.infer<typeof babyParamsSchema>;
