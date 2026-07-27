import { PrismaClient } from '@prisma/client';
import { NotificationRepository } from '../../../application/notification/notification-repository';
import { Notification, NotificationType } from '../../../domain/notification/notification';

interface NotificationRow {
  id: string;
  userId: string;
  babyId: string;
  type: string;
  referenceId: string;
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

function toDomain(row: NotificationRow): Notification {
  return Notification.restore({
    id: row.id,
    userId: row.userId,
    babyId: row.babyId,
    type: row.type as NotificationType,
    referenceId: row.referenceId,
    title: row.title,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
  });
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Notification | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAllByUserId(userId: string): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toDomain);
  }

  async existsForTrigger(babyId: string, type: NotificationType, referenceId: string): Promise<boolean> {
    const row = await this.prisma.notification.findUnique({
      where: { babyId_type_referenceId: { babyId, type, referenceId } },
    });
    return row !== null;
  }

  async save(notification: Notification): Promise<void> {
    await this.prisma.notification.upsert({
      where: { id: notification.id },
      create: {
        id: notification.id,
        userId: notification.userId,
        babyId: notification.babyId,
        type: notification.type,
        referenceId: notification.referenceId,
        title: notification.title,
        message: notification.message,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      },
      update: {
        readAt: notification.readAt,
      },
    });
  }
}
