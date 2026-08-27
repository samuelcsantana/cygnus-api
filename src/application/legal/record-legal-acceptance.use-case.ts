import { randomUUID } from 'node:crypto';
import { LegalAcceptance, LegalDocumentId } from '../../domain/legal/legal-acceptance';
import { LegalAcceptanceRepository } from './legal-acceptance-repository';

export interface RecordLegalAcceptanceInput {
  userId: string;
  documentId: LegalDocumentId;
  version: string;
}

export class RecordLegalAcceptanceUseCase {
  constructor(private readonly legalAcceptanceRepository: LegalAcceptanceRepository) {}

  async execute(input: RecordLegalAcceptanceInput): Promise<LegalAcceptance> {
    // Accepting the same version twice returns the first acceptance rather than replacing it. A
    // second POST is what a double-tap or a retried request looks like, and moving the timestamp
    // forward would quietly rewrite when the consent was actually given — the one fact the record
    // exists to hold.
    const existing = await this.legalAcceptanceRepository.findByUserDocumentAndVersion(
      input.userId,
      input.documentId,
      input.version,
    );

    if (existing) {
      return existing;
    }

    const acceptance = LegalAcceptance.record({
      id: randomUUID(),
      userId: input.userId,
      documentId: input.documentId,
      version: input.version,
    });

    await this.legalAcceptanceRepository.save(acceptance);

    return acceptance;
  }
}
