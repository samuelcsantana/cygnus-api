import { Notification, NotificationType } from '../../domain/notification/notification';

export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findAllByUserId(userId: string): Promise<Notification[]>;
  existsForTrigger(babyId: string, type: NotificationType, referenceId: string): Promise<boolean>;
  save(notification: Notification): Promise<void>;
}
