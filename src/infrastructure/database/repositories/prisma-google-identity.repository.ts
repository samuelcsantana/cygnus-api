import { randomUUID } from 'node:crypto';
import { GoogleIdentity, GoogleIdentityRepository, GoogleSignInError } from '../../../application/user/google-identity';
import { User } from '../../../domain/user/user';
import { PrismaClient } from '../../../generated/prisma/client';

export class PrismaGoogleIdentityRepository implements GoogleIdentityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySubject(subject: string): Promise<User | null> {
    const identity = await this.prisma.googleIdentity.findUnique({ where: { subject }, include: { user: true } });
    return identity ? User.fromPersistence(identity.user) : null;
  }

  async connect(identity: GoogleIdentity, passwordHash: string): Promise<User> {
    // Unique constraints settle simultaneous callbacks; the retry re-evaluates
    // ownership instead of attaching an identity to a stale account lookup.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const linked = await tx.googleIdentity.findUnique({ where: { subject: identity.subject }, include: { user: true } });
          if (linked) return User.fromPersistence(linked.user);
          const email = identity.email.trim().toLowerCase();
          const existing = await tx.user.findUnique({ where: { email }, include: { googleIdentity: true } });
          if (existing && (!identity.authoritativeEmail || existing.googleIdentity)) {
            throw new GoogleSignInError('email_verification_required');
          }
          const user = existing ?? await tx.user.create({ data: {
            id: randomUUID(), email, name: identity.name.trim(), passwordHash,
          } });
          await tx.googleIdentity.create({ data: { subject: identity.subject, userId: user.id } });
          return User.fromPersistence(user);
        });
      } catch (error) {
        if (attempt === 0 && typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') continue;
        throw error;
      }
    }
    throw new GoogleSignInError();
  }
}
