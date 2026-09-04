import { Specialist } from '../../domain/specialist/specialist';
import { SpecialistRepository } from './specialist-repository';

export interface ListVisibleSpecialistsInput {
  requestingUserId: string;
  /** Optional filter: only the professionals linked to this child. */
  babyId?: string;
}

/**
 * Everything the caller can see, optionally narrowed to one child.
 *
 * The filter is applied after the visibility query rather than inside it, and that ordering is the
 * security property: narrowing can only ever remove rows the caller was already allowed to see.
 */
export class ListVisibleSpecialistsUseCase {
  constructor(private readonly specialistRepository: SpecialistRepository) {}

  async execute(input: ListVisibleSpecialistsInput): Promise<Specialist[]> {
    const visible = await this.specialistRepository.findAllVisibleTo(input.requestingUserId);

    if (!input.babyId) {
      return visible;
    }

    return visible.filter((specialist) => specialist.babyIds.includes(input.babyId!));
  }
}
