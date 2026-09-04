import { InvalidSpecialistNameError } from './errors/invalid-specialist-name.error';

export interface SpecialistProps {
  id: string;
  babyId: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  createdAt: Date;
}

export interface RegisterSpecialistProps {
  id: string;
  babyId: string;
  name: string;
  specialty?: string | null;
  phone?: string | null;
  createdAt?: Date;
}

/**
 * A professional who looks after a child.
 *
 * Deliberately thin: a name, what they do, and how to reach them. It exists because
 * `Appointment.doctorName` is free text, which makes "Dra. Fernanda Lima", "Dra Fernanda Lima" and
 * "Fernanda Lima" three different people, and gives a phone number nowhere to live.
 */
export class Specialist {
  readonly id: string;
  readonly babyId: string;
  readonly name: string;
  readonly specialty: string | null;
  readonly phone: string | null;
  readonly createdAt: Date;

  private constructor(props: SpecialistProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.name = props.name;
    this.specialty = props.specialty;
    this.phone = props.phone;
    this.createdAt = props.createdAt;
  }

  static register(props: RegisterSpecialistProps): Specialist {
    const name = props.name.trim();

    if (name.length === 0) {
      throw new InvalidSpecialistNameError();
    }

    return new Specialist({
      id: props.id,
      babyId: props.babyId,
      name,
      // Trimmed to empty means "not given". A phone stored as a single space is a field that looks
      // filled in the list and is useless at the moment it is needed.
      specialty: normalizeOptional(props.specialty),
      phone: normalizeOptional(props.phone),
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
