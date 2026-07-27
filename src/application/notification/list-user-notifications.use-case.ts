import { Notification } from '../../domain/notification/notification';
import { NotificationRepository } from './notification-repository';

export class ListUserNotificationsUseCase {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(userId: string): Promise<Notification[]> {
    return this.notificationRepository.findAllByUserId(userId);
  }
}
