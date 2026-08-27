import { LegalAcceptance, LegalDocumentId } from '../../domain/legal/legal-acceptance';

export interface LegalAcceptanceRepository {
  findAllByUserId(userId: string): Promise<LegalAcceptance[]>;
  findByUserDocumentAndVersion(
    userId: string,
    documentId: LegalDocumentId,
    version: string,
  ): Promise<LegalAcceptance | null>;
  save(acceptance: LegalAcceptance): Promise<void>;
}
