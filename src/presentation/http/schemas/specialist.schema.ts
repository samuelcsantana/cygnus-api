import { z } from 'zod';

export const specialistIdOnlyParamsSchema = z.object({
  specialistId: z.string().uuid(),
});

export const specialistListQuerystringSchema = z.object({
  babyId: z.string().uuid().optional().describe('Narrows the list to the professionals linked to this child'),
});

/** @deprecated Params das rotas por criança, mantidas como ponte. */
export const specialistParamsSchema = z.object({
  babyId: z.string().uuid(),
});

/** @deprecated Idem. */
export const specialistIdParamsSchema = z.object({
  babyId: z.string().uuid(),
  specialistId: z.string().uuid(),
});

// Free text, and no format check on the phone: a number can be a landline, a mobile, a clinic
// switchboard with an extension, or one written with the country code — and this is the field
// somebody reaches for at 3am. Refusing a real number to enforce a shape would be the one failure
// it cannot afford.
export const createSpecialistBodySchema = z.object({
  name: z.string().min(1).describe('The professional as the family refers to them, e.g. Dra. Fernanda Lima'),
  specialty: z.string().optional().describe('What they do, e.g. Pediatria. Free text, see GET /specialties'),
  phone: z.string().optional().describe('How to reach them. Stored as typed'),
  babyIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Children this professional looks after. Omit or send [] for none — a private entry'),
  sharedWithUserIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Guardians who should also see this entry. Restricted to people who already share a child with you'),
});

export const updateSpecialistBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    specialty: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    // Absent leaves the links alone; `[]` means "none", which is a real answer.
    babyIds: z.array(z.string().uuid()).optional(),
    sharedWithUserIds: z.array(z.string().uuid()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

export const specialistResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid().describe('Who created it. Only this person can edit or remove it'),
    name: z.string(),
    specialty: z.string().nullable(),
    phone: z.string().nullable(),
    babyIds: z.array(z.string().uuid()),
    sharedWithUserIds: z.array(z.string().uuid()),
    /**
     * @deprecated Espelho da primeira criança vinculada, para o front que ainda lê `babyId`.
     *
     * Sai junto com as rotas por criança. Um profissional ligado a nenhuma criança devolve `null`
     * aqui, e o front antigo simplesmente não o mostra — o que é melhor do que quebrar o parse.
     */
    babyId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .describe('A professional who looks after this family. Belongs to the account, not to one child');

export const specialistListResponseSchema = z.array(specialistResponseSchema);

export type CreateSpecialistBody = z.infer<typeof createSpecialistBodySchema>;
export type UpdateSpecialistBody = z.infer<typeof updateSpecialistBodySchema>;
