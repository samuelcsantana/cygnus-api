import { InvalidSpecialistNameError } from './errors/invalid-specialist-name.error';

export interface SpecialistProps {
  id: string;
  userId: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  /** The children this professional looks after. Empty is a valid answer: a private address entry. */
  babyIds: string[];
  /** Guardians this entry was handed to by name, for when it is linked to no child. */
  sharedWithUserIds: string[];
  createdAt: Date;
}

export interface RegisterSpecialistProps {
  id: string;
  userId: string;
  name: string;
  specialty?: string | null;
  phone?: string | null;
  babyIds?: string[];
  sharedWithUserIds?: string[];
  createdAt?: Date;
}

/**
 * A professional who looks after a family's children.
 *
 * Belongs to the **account**, not to one child: the paediatrician is typed once and serves every
 * sibling. Who can see it is not a property of this entity — it is the union of ownership, the
 * children it is linked to, and the guardians it was shared with, and that union lives in the
 * repository's query because only the database can answer it.
 */
export class Specialist {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly specialty: string | null;
  readonly phone: string | null;
  readonly babyIds: string[];
  readonly sharedWithUserIds: string[];
  readonly createdAt: Date;

  private constructor(props: SpecialistProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.specialty = props.specialty;
    this.phone = props.phone;
    this.babyIds = props.babyIds;
    this.sharedWithUserIds = props.sharedWithUserIds;
    this.createdAt = props.createdAt;
  }

  static register(props: RegisterSpecialistProps): Specialist {
    const name = props.name.trim();

    if (name.length === 0) {
      throw new InvalidSpecialistNameError();
    }

    return new Specialist({
      id: props.id,
      userId: props.userId,
      name,
      // Trimmed to empty means "not given". A phone stored as a single space looks filled in the
      // list and is useless at the moment it is needed.
      specialty: normalizeOptional(props.specialty),
      phone: normalizeOptional(props.phone),
      babyIds: unique(props.babyIds ?? []),
      // Sharing with yourself is not sharing; it would also make the owner appear in their own
      // share list, which reads as if somebody else had granted them access to their own entry.
      sharedWithUserIds: unique(props.sharedWithUserIds ?? []).filter((userId) => userId !== props.userId),
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: SpecialistProps): Specialist {
    return new Specialist(props);
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
