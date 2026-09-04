import { PrismaClient } from '../../../generated/prisma/client';
import { AppointmentRepository } from '../../../application/appointment/appointment-repository';
import { Appointment, AppointmentStatus } from '../../../domain/appointment/appointment';

interface AppointmentRow {
  id: string;
  babyId: string;
  scheduledAt: Date;
  doctorName: string;
  specialty: string | null;
  location: string | null;
  reason: string | null;
  notes: string | null;
  status: string;
  weightGrams: number | null;
  heightMillimeters: number | null;
  createdAt: Date;
}

function toDomain(row: AppointmentRow): Appointment {
  return Appointment.restore({
    id: row.id,
    babyId: row.babyId,
    scheduledAt: row.scheduledAt,
    doctorName: row.doctorName,
    specialty: row.specialty,
    location: row.location,
    reason: row.reason,
    notes: row.notes,
    status: row.status as AppointmentStatus,
    weightGrams: row.weightGrams,
    heightMillimeters: row.heightMillimeters,
    createdAt: row.createdAt,
  });
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAllByBabyId(babyId: string, search?: string): Promise<Appointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        babyId,
        ...(search
          ? {
              OR: [
                { doctorName: { contains: search, mode: 'insensitive' } },
                { specialty: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
                { reason: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return rows.map(toDomain);
  }

  async save(appointment: Appointment): Promise<void> {
    await this.prisma.appointment.upsert({
      where: { id: appointment.id },
      create: {
        id: appointment.id,
        babyId: appointment.babyId,
        scheduledAt: appointment.scheduledAt,
        doctorName: appointment.doctorName,
        specialty: appointment.specialty,
        location: appointment.location,
        reason: appointment.reason,
        notes: appointment.notes,
        status: appointment.status,
        weightGrams: appointment.weightGrams,
        heightMillimeters: appointment.heightMillimeters,
        createdAt: appointment.createdAt,
      },
      update: {
        scheduledAt: appointment.scheduledAt,
        doctorName: appointment.doctorName,
        specialty: appointment.specialty,
        location: appointment.location,
        reason: appointment.reason,
        notes: appointment.notes,
        status: appointment.status,
        weightGrams: appointment.weightGrams,
        heightMillimeters: appointment.heightMillimeters,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.appointment.delete({ where: { id } });
  }
}
