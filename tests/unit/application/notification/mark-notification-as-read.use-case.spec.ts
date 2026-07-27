import { describe, expect, it, vi } from 'vitest';
import { MarkNotificationAsReadUseCase } from '../../../../src/application/notification/mark-notification-as-read.use-case';
import { NotificationNotFoundError } from '../../../../src/application/notification/errors/notification-not-found.error';
import { Notification } from '../../../../src/domain/notification/notification';
import { buildNotificationRepository } from './notification-test-helpers';

describe('MarkNotificationAsReadUseCase', () => {
  it('marks the notification as read when it belongs to the requesting user', async () => {
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
      findById: vi.fn().mockResolvedValue(notification),
    });
    const useCase = new MarkNotificationAsReadUseCase(notificationRepository);

    const result = await useCase.execute({ notificationId: notification.id, requestingUserId: 'owner-id' });

    expect(result.readAt).not.toBeNull();
    expect(notificationRepository.save).toHaveBeenCalledWith(result);
  });

  it("rejects marking another user's notification as read", async () => {
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
      findById: vi.fn().mockResolvedValue(notification),
    });
    const useCase = new MarkNotificationAsReadUseCase(notificationRepository);

    await expect(
      useCase.execute({ notificationId: notification.id, requestingUserId: 'intruder-id' }),
    ).rejects.toThrow(NotificationNotFoundError);
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects marking a notification that does not exist', async () => {
    const notificationRepository = buildNotificationRepository({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new MarkNotificationAsReadUseCase(notificationRepository);

    await expect(
      useCase.execute({ notificationId: 'missing-id', requestingUserId: 'owner-id' }),
    ).rejects.toThrow(NotificationNotFoundError);
  });
});
