import { describe, expect, it, vi } from 'vitest';
import { ListUserNotificationsUseCase } from '../../../../src/application/notification/list-user-notifications.use-case';
import { Notification } from '../../../../src/domain/notification/notification';
import { buildNotificationRepository } from './notification-test-helpers';

describe('ListUserNotificationsUseCase', () => {
  it("returns the user's notifications", async () => {
    const notification = Notification.create({
      id: 'notification-1',
      userId: 'owner-id',
      babyId: 'baby-1',
      type: 'VACCINE_DELAYED',
      referenceId: 'vaccine-1',
      title: 'Vacina atrasada',
      message: 'A vacina X está atrasada',
    });
    const notificationRepository = buildNotificationRepository({
      findAllByUserId: vi.fn().mockResolvedValue([notification]),
    });
    const useCase = new ListUserNotificationsUseCase(notificationRepository);

    const notifications = await useCase.execute('owner-id');

    expect(notificationRepository.findAllByUserId).toHaveBeenCalledWith('owner-id');
    expect(notifications).toEqual([notification]);
  });
});
