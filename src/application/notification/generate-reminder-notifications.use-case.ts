import { randomUUID } from 'node:crypto';
import { BabyRepository } from '../baby/baby-repository';
import { VaccineRepository } from '../vaccine/vaccine-repository';
import { BabyVaccineRecordRepository } from '../vaccine/baby-vaccine-record-repository';
import { AppointmentRepository } from '../appointment/appointment-repository';
import { NotificationRepository } from './notification-repository';
import { Baby } from '../../domain/baby/baby';
import { Vaccine } from '../../domain/vaccine/vaccine';
import { BabyVaccineRecord } from '../../domain/vaccine/baby-vaccine-record';
import { Notification } from '../../domain/notification/notification';
import { addMonthsClamped } from '../../shared/utils/date';

const APPOINTMENT_REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export interface GenerateReminderNotificationsResult {
  createdCount: number;
}

export class GenerateReminderNotificationsUseCase {
  constructor(
    private readonly babyRepository: BabyRepository,
    private readonly vaccineRepository: VaccineRepository,
    private readonly babyVaccineRecordRepository: BabyVaccineRecordRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(referenceDate: Date = new Date()): Promise<GenerateReminderNotificationsResult> {
    const babies = await this.babyRepository.findAll();
    const vaccines = await this.vaccineRepository.findAll();
    let createdCount = 0;

    for (const baby of babies) {
      createdCount += await this.generateVaccineDelayNotifications(baby, vaccines, referenceDate);
      createdCount += await this.generateAppointmentReminderNotifications(baby, referenceDate);
    }

    return { createdCount };
  }

  private async generateVaccineDelayNotifications(
    baby: Baby,
    vaccines: Vaccine[],
    referenceDate: Date,
  ): Promise<number> {
    const appliedRecords = await this.babyVaccineRecordRepository.findAllByBabyId(baby.id);
    const appliedVaccineIds = new Set(appliedRecords.map((record) => record.vaccineId));
    let created = 0;

    for (const vaccine of vaccines) {
      if (appliedVaccineIds.has(vaccine.id)) {
        continue;
      }

      const dueDate = addMonthsClamped(baby.birthDate, vaccine.recommendedAgeInMonths);
      const record = BabyVaccineRecord.derive({
        id: `${baby.id}:${vaccine.id}`,
        babyId: baby.id,
        vaccineId: vaccine.id,
        dueDate,
        referenceDate,
      });

      if (record.status !== 'DELAYED') {
        continue;
      }

      const alreadyNotified = await this.notificationRepository.existsForTrigger(
        baby.id,
        'VACCINE_DELAYED',
        vaccine.id,
      );

      if (alreadyNotified) {
        continue;
      }

      await this.notificationRepository.save(
        Notification.create({
          id: randomUUID(),
          userId: baby.userId,
          babyId: baby.id,
          type: 'VACCINE_DELAYED',
          referenceId: vaccine.id,
          title: `Vacina atrasada: ${vaccine.name}`,
          message: `A vacina ${vaccine.name} de ${baby.name} está atrasada.`,
        }),
      );
      created += 1;
    }

    return created;
  }

  private async generateAppointmentReminderNotifications(baby: Baby, referenceDate: Date): Promise<number> {
    const appointments = await this.appointmentRepository.findAllByBabyId(baby.id);
    let created = 0;

    for (const appointment of appointments) {
      if (appointment.status !== 'SCHEDULED') {
        continue;
      }

      const millisecondsUntilAppointment = appointment.scheduledAt.getTime() - referenceDate.getTime();
      const isUpcoming = millisecondsUntilAppointment >= 0 && millisecondsUntilAppointment <= APPOINTMENT_REMINDER_WINDOW_MS;

      if (!isUpcoming) {
        continue;
      }

      const alreadyNotified = await this.notificationRepository.existsForTrigger(
        baby.id,
        'APPOINTMENT_UPCOMING',
        appointment.id,
      );

      if (alreadyNotified) {
        continue;
      }

      await this.notificationRepository.save(
        Notification.create({
          id: randomUUID(),
          userId: baby.userId,
          babyId: baby.id,
          type: 'APPOINTMENT_UPCOMING',
          referenceId: appointment.id,
          title: `Consulta próxima com ${appointment.doctorName}`,
          message: `${baby.name} tem consulta com ${appointment.doctorName} em ${appointment.scheduledAt.toISOString()}.`,
        }),
      );
      created += 1;
    }

    return created;
  }
}
