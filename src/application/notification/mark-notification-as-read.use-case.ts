import { Notification } from '../../domain/notification/notification';
import { NotificationRepository } from './notification-repository';
import { NotificationNotFoundError } from './errors/notification-not-found.error';

export interface MarkNotificationAsReadInput {
  notificationId: string;
  requestingUserId: string;
}

export class MarkNotificationAsReadUseCase {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(input: MarkNotificationAsReadInput): Promise<Notification> {
    const notification = await this.notificationRepository.findById(input.notificationId);

    if (!notification || notification.userId !== input.requestingUserId) {
      throw new NotificationNotFoundError();
    }

    const readNotification = notification.markAsRead();
    await this.notificationRepository.save(readNotification);

    return readNotification;
  }
}
