import { PrismaClient } from '@prisma/client';
import { BabyInviteRepository } from '../../../application/baby/baby-invite-repository';
import { BabyInvite } from '../../../domain/baby/baby-invite';

interface BabyInviteRow {
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

function toDomain(row: BabyInviteRow): BabyInvite {
  return BabyInvite.restore({
    id: row.id,
    babyId: row.babyId,
    code: row.code,
    createdByUserId: row.createdByUserId,
    inviteeEmail: row.inviteeEmail,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    usedByUserId: row.usedByUserId,
    createdAt: row.createdAt,
  });
}

export class PrismaBabyInviteRepository implements BabyInviteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCode(code: string): Promise<BabyInvite | null> {
    const row = await this.prisma.babyInvite.findUnique({ where: { code } });
    return row ? toDomain(row) : null;
  }

  async save(invite: BabyInvite): Promise<void> {
    await this.prisma.babyInvite.upsert({
      where: { id: invite.id },
      create: {
        id: invite.id,
        babyId: invite.babyId,
        code: invite.code,
        createdByUserId: invite.createdByUserId,
        inviteeEmail: invite.inviteeEmail,
        expiresAt: invite.expiresAt,
        usedAt: invite.usedAt,
        usedByUserId: invite.usedByUserId,
        createdAt: invite.createdAt,
      },
      update: {
        usedAt: invite.usedAt,
        usedByUserId: invite.usedByUserId,
      },
    });
  }
}
