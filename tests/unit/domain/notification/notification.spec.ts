import { describe, expect, it } from 'vitest';
import { Notification } from '../../../../src/domain/notification/notification';

describe('Notification', () => {
  it('is created unread', () => {
    const notification = Notification.create({
      id: 'notification-1',
      userId: 'user-1',
      babyId: 'baby-1',
      type: 'VACCINE_DELAYED',
      referenceId: 'vaccine-1',
      title: 'Vacina atrasada',
      message: 'A vacina X está atrasada',
    });

    expect(notification.readAt).toBeNull();
  });

  it('markAsRead sets readAt while preserving the other fields', () => {
    const notification = Notification.create({
      id: 'notification-1',
      userId: 'user-1',
      babyId: 'baby-1',
      type: 'APPOINTMENT_UPCOMING',
      referenceId: 'appointment-1',
      title: 'Consulta próxima',
      message: 'Consulta amanhã',
    });

    const readNotification = notification.markAsRead();

    expect(readNotification.readAt).not.toBeNull();
    expect(readNotification.id).toBe(notification.id);
    expect(readNotification.title).toBe(notification.title);
    expect(readNotification.message).toBe(notification.message);
  });
});
