import { z } from 'zod';

/**
 * The two documents a user can accept. Lowercase because these values are the frontend's document
 * registry (`shared/legal.ts`), which is the single source of both the id and the version.
 */
const legalDocumentIdSchema = z.enum(['privacy', 'terms']);

export const recordLegalAcceptanceBodySchema = z.object({
  documentId: legalDocumentIdSchema,
  version: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .describe(
      'The exact version string of the document that was shown and accepted. Accepting a version ' +
        'other than the one currently in force is recorded as given — it is a fact about the past, ' +
        'not a claim about the current text.',
    ),
});

export const legalAcceptanceResponseSchema = z.object({
  documentId: legalDocumentIdSchema,
  version: z.string(),
  acceptedAt: z.string().datetime(),
});

export const legalAcceptanceListResponseSchema = z.array(legalAcceptanceResponseSchema);

export type RecordLegalAcceptanceBody = z.infer<typeof recordLegalAcceptanceBodySchema>;
