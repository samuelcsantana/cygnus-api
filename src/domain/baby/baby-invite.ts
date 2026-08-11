export interface BabyInviteProps {
  id: string;
  babyId: string;
  code: string;
  createdByUserId: string;
  inviteeEmail: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  usedByUserId: string | null;
  createdAt: Date;
}

export interface CreateBabyInviteProps {
  id: string;
  babyId: string;
  code: string;
  createdByUserId: string;
  inviteeEmail?: string | null;
  expiresAt: Date;
  createdAt?: Date;
}

export class BabyInvite {
  readonly id: string;
  readonly babyId: string;
  readonly code: string;
  readonly createdByUserId: string;
  readonly inviteeEmail: string | null;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly usedByUserId: string | null;
  readonly createdAt: Date;

  private constructor(props: BabyInviteProps) {
    this.id = props.id;
    this.babyId = props.babyId;
    this.code = props.code;
    this.createdByUserId = props.createdByUserId;
    this.inviteeEmail = props.inviteeEmail;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt;
    this.usedByUserId = props.usedByUserId;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateBabyInviteProps): BabyInvite {
    return new BabyInvite({
      id: props.id,
      babyId: props.babyId,
      code: props.code,
      createdByUserId: props.createdByUserId,
      inviteeEmail: props.inviteeEmail ?? null,
      expiresAt: props.expiresAt,
      usedAt: null,
      usedByUserId: null,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static restore(props: BabyInviteProps): BabyInvite {
    return new BabyInvite(props);
  }

  isExpired(referenceDate: Date = new Date()): boolean {
    return this.expiresAt.getTime() < referenceDate.getTime();
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  redeem(usedByUserId: string, referenceDate: Date = new Date()): BabyInvite {
    return new BabyInvite({
      id: this.id,
      babyId: this.babyId,
      code: this.code,
      createdByUserId: this.createdByUserId,
      inviteeEmail: this.inviteeEmail,
      expiresAt: this.expiresAt,
      usedAt: referenceDate,
      usedByUserId,
      createdAt: this.createdAt,
    });
  }
}
