import { PrismaClient } from '../../../generated/prisma/client';
import { UserRepository } from '../../../application/user/user-repository';
import { User } from '../../../domain/user/user';

function toDomain(record: {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl: string | null;
  emailNotificationsEnabled: boolean;
  createdAt: Date;
  sessionVersion: number;
  demoExpiresAt: Date | null;
}): User {
  return User.fromPersistence({
    id: record.id,
    email: record.email,
    passwordHash: record.passwordHash,
    name: record.name,
    avatarUrl: record.avatarUrl,
    emailNotificationsEnabled: record.emailNotificationsEnabled,
    createdAt: record.createdAt,
    sessionVersion: record.sessionVersion,
    demoExpiresAt: record.demoExpiresAt,
  });
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return record ? toDomain(record) : null;
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailNotificationsEnabled: user.emailNotificationsEnabled,
        createdAt: user.createdAt,
        sessionVersion: user.sessionVersion,
        demoExpiresAt: user.demoExpiresAt,
      },
      // `demoExpiresAt` is written on create and never here. Every edit rebuilds the entity through
      // `User.create`, and one call site that forgot to carry the expiry over would quietly turn a
      // disposable account into a permanent one. Leaving it out makes the column immutable instead
      // of making every future call site responsible for it.
      update: {
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailNotificationsEnabled: user.emailNotificationsEnabled,
        sessionVersion: user.sessionVersion,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
