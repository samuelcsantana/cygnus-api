export type GuardianRole = 'OWNER' | 'GUARDIAN';

export interface BabyGuardianProps {
  id: string;
  babyId: string;
  userId: string;
  role: GuardianRole;
  createdAt: Date;
}

export interface CreateBabyGuardianProps {
  id: string;
  babyId: string;
  userId: string;
  role?: GuardianRole;
  createdAt?: Date;
}

export class BabyGuardian {
  readonly id: string;
  readonly babyId: string;
  readonly userId: string;
  readonly role: GuardianRole;
  readonly createdAt: Date;

  private constructor(props: BabyGuardianProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.userId = props.userId;
    this.role = props.role;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateBabyGuardianProps): BabyGuardian {
    return new BabyGuardian({
      id: props.id,
      babyId: props.babyId,
      userId: props.userId,
      role: props.role ?? 'GUARDIAN',
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: BabyGuardianProps): BabyGuardian {
    return new BabyGuardian(props);
  }

  isOwner(): boolean {
    return this.role === 'OWNER';
  }
}
