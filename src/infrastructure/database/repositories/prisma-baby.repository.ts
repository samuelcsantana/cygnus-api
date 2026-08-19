import { PrismaClient } from '../../../generated/prisma/client';
import { BabyRepository } from '../../../application/baby/baby-repository';
import { Baby, BabyGender } from '../../../domain/baby/baby';

interface BabyRecord {
  id: string;
  userId: string;
  name: string;
  birthDate: Date;
  gender: string;
  bloodType: string | null;
  allergies: string[];
  avatarUrl: string | null;
  avatarColor: string | null;
  createdAt: Date;
}

function toDomain(record: BabyRecord): Baby {
  return Baby.create({
    id: record.id,
    userId: record.userId,
    name: record.name,
    birthDate: record.birthDate,
    gender: record.gender as BabyGender,
    bloodType: record.bloodType,
    allergies: record.allergies,
    avatarUrl: record.avatarUrl,
    avatarColor: record.avatarColor,
    createdAt: record.createdAt,
  });
}

export class PrismaBabyRepository implements BabyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Baby | null> {
    const record = await this.prisma.baby.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findAllByUserId(userId: string): Promise<Baby[]> {
    const records = await this.prisma.baby.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return records.map(toDomain);
  }

  async findAll(): Promise<Baby[]> {
    const records = await this.prisma.baby.findMany({ orderBy: { createdAt: 'asc' } });
    return records.map(toDomain);
  }

  async save(baby: Baby): Promise<void> {
    await this.prisma.baby.upsert({
      where: { id: baby.id },
      create: {
        id: baby.id,
        userId: baby.userId,
        name: baby.name,
        birthDate: baby.birthDate,
        gender: baby.gender,
        bloodType: baby.bloodType,
        allergies: baby.allergies,
        avatarUrl: baby.avatarUrl,
        avatarColor: baby.avatarColor,
        createdAt: baby.createdAt,
      },
      update: {
        name: baby.name,
        birthDate: baby.birthDate,
        gender: baby.gender,
        bloodType: baby.bloodType,
        allergies: baby.allergies,
        avatarUrl: baby.avatarUrl,
        avatarColor: baby.avatarColor,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.baby.delete({ where: { id } });
  }
}
