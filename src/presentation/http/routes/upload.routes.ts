import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { App } from '../../../infrastructure/http/build-app';
import { MILESTONE_PHOTOS_DIR } from '../../../shared/config/uploads';
import { authenticate } from '../plugins/authenticate';
import { authErrorResponseSchema } from '../schemas/auth.schema';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const uploadResponseSchema = z
  .object({
    url: z.string().url().describe('Absolute, publicly reachable URL of the uploaded photo'),
  })
  .describe('The uploaded milestone photo');

function isFileTooLargeError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE';
}

export async function uploadRoutes(app: App) {
  app.route({
    method: 'POST',
    url: '/uploads/milestone-photos',
    preHandler: authenticate,
    schema: {
      tags: ['Uploads'],
      summary: 'Upload a milestone photo',
      description:
        'Uploads an image (JPEG, PNG or WEBP, up to 5MB) as multipart/form-data under the "photo" field and ' +
        'returns its absolute public URL, to be used as a `Milestone.photoUrl`. Requires authentication to ' +
        'upload, but the resulting file is served publicly with no access control, consistent with `photoUrl` ' +
        'already accepting arbitrary public image URLs today.',
      consumes: ['multipart/form-data'],
      response: {
        201: uploadResponseSchema,
        400: authErrorResponseSchema,
        401: authErrorResponseSchema,
        500: authErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      let file;

      try {
        file = await request.file();
      } catch {
        return reply.status(400).send({ status: 'error', message: 'Request must be multipart/form-data' });
      }

      if (!file || file.fieldname !== 'photo') {
        return reply.status(400).send({ status: 'error', message: 'Missing "photo" file field' });
      }

      const extension = ALLOWED_MIME_TYPES[file.mimetype];

      if (!extension) {
        return reply
          .status(400)
          .send({ status: 'error', message: 'Unsupported file type. Allowed types: image/jpeg, image/png, image/webp' });
      }

      let buffer: Buffer;

      try {
        buffer = await file.toBuffer();
      } catch (error) {
        if (isFileTooLargeError(error)) {
          return reply.status(400).send({ status: 'error', message: 'File exceeds the maximum allowed size of 5MB' });
        }

        throw error;
      }

      const filename = `${randomUUID()}.${extension}`;
      await fs.mkdir(MILESTONE_PHOTOS_DIR, { recursive: true });
      await fs.writeFile(path.join(MILESTONE_PHOTOS_DIR, filename), buffer);

      const url = `${request.protocol}://${request.headers.host}/uploads/milestone-photos/${filename}`;

      return reply.status(201).send({ url });
    },
  });
}
