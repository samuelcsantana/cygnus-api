import { LegalAcceptance } from '../../domain/legal/legal-acceptance';
import { LegalAcceptanceRepository } from './legal-acceptance-repository';

export class ListLegalAcceptancesUseCase {
  constructor(private readonly legalAcceptanceRepository: LegalAcceptanceRepository) {}

  execute(userId: string): Promise<LegalAcceptance[]> {
    return this.legalAcceptanceRepository.findAllByUserId(userId);
  }
}
