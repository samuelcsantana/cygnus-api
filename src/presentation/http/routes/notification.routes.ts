import type { App } from '../../../infrastructure/http/build-app';
import { Notification } from '../../../domain/notification/notification';
import { ListUserNotificationsUseCase } from '../../../application/notification/list-user-notifications.use-case';
import { MarkNotificationAsReadUseCase } from '../../../application/notification/mark-notification-as-read.use-case';
import { NotificationNotFoundError } from '../../../application/notification/errors/notification-not-found.error';
import { PrismaNotificationRepository } from '../../../infrastructure/database/repositories/prisma-notification.repository';
import { prisma } from '../../../infrastructure/database/prisma-client';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';
import {
  notificationListResponseSchema,
  notificationParamsSchema,
  notificationResponseSchema,
} from '../schemas/notification.schema';

function toResponse(notification: Notification) {
  return {
    id: notification.id,
    babyId: notification.babyId,
    type: notification.type,
    referenceId: notification.referenceId,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function notificationRoutes(app: App) {
  const notificationRepository = new PrismaNotificationRepository(prisma);
  const listUserNotificationsUseCase = new ListUserNotificationsUseCase(notificationRepository);
  const markNotificationAsReadUseCase = new MarkNotificationAsReadUseCase(notificationRepository);

  app.route({
    method: 'GET',
    url: '/notifications',
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: "List the authenticated user's notifications",
      description: 'Returns in-app alerts such as delayed vaccines and upcoming appointments, newest first.',
      response: {
        200: notificationListResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const notifications = await listUserNotificationsUseCase.execute(request.userId);
      return reply.status(200).send(notifications.map(toResponse));
    },
  });

  app.route({
    method: 'PATCH',
    url: '/notifications/:notificationId/read',
    preHandler: authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Mark a notification as read',
      params: notificationParamsSchema,
      response: {
        200: notificationResponseSchema,
        401: authErrorResponseSchema,
        404: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const notification = await markNotificationAsReadUseCase.execute({
          notificationId: request.params.notificationId,
          requestingUserId: request.userId,
        });

        return reply.status(200).send(toResponse(notification));
      } catch (error) {
        if (error instanceof NotificationNotFoundError) {
          return reply.status(404).send({ status: 'error', message: error.message });
        }

        throw error;
      }
    },
  });
}
