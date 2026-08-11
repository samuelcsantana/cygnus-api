import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../../application/user/user-repository';
import { User } from '../../../domain/user/user';

function toDomain(record: {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  emailNotificationsEnabled: boolean;
  createdAt: Date;
}): User {
  return User.create({
    id: record.id,
    email: record.email,
    passwordHash: record.passwordHash,
    name: record.name,
    emailNotificationsEnabled: record.emailNotificationsEnabled,
    createdAt: record.createdAt,
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
        emailNotificationsEnabled: user.emailNotificationsEnabled,
        createdAt: user.createdAt,
      },
      update: {
        email: user.email,
        passwordHash: user.passwordHash,
        name: user.name,
        emailNotificationsEnabled: user.emailNotificationsEnabled,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
