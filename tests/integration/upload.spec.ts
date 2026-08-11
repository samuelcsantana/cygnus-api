import fs from 'node:fs';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/infrastructure/http/build-app';
import { prisma } from '../../src/infrastructure/database/prisma-client';
import { MILESTONE_PHOTOS_DIR } from '../../src/shared/config/uploads';

// A minimal but valid 1x1 transparent PNG — real image bytes, not a placeholder buffer, so
// MIME/size handling is exercised the same way a real upload would.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('Upload routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  function extractCookieHeader(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    return values.map((cookie) => cookie.split(';')[0]).join('; ');
  }

  function extractCsrfToken(setCookieHeader: string | string[] | undefined): string {
    const values = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    const csrfCookie = values.find((value) => value.startsWith('csrf_token='));
    return csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '';
  }

  async function registerAndLogin(email: string): Promise<{ cookie: string; csrfToken: string }> {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'S3cur3-Password', name: 'Parent' },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'S3cur3-Password' },
    });

    return {
      cookie: extractCookieHeader(loginResponse.headers['set-cookie']),
      csrfToken: extractCsrfToken(loginResponse.headers['set-cookie']),
    };
  }

  function buildMultipartBody(
    boundary: string,
    fieldName: string,
    filename: string,
    contentType: string,
    fileContent: Buffer,
  ): Buffer {
    const CRLF = '\r\n';
    const header = Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${CRLF}` +
        `Content-Type: ${contentType}${CRLF}${CRLF}`,
    );
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
    return Buffer.concat([header, fileContent, footer]);
  }

  describe('POST /uploads/milestone-photos', () => {
    it('uploads a real image and writes it to disk, returning an absolute public URL', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-upload@example.com');
      const boundary = '----uploadTestBoundary1';
      const body = buildMultipartBody(boundary, 'photo', 'baby-smile.png', 'image/png', TINY_PNG);

      const response = await app.inject({
        method: 'POST',
        url: '/uploads/milestone-photos',
        headers: {
          cookie,
          'x-csrf-token': csrfToken,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.url).toMatch(/^http:\/\/.+\/uploads\/milestone-photos\/[0-9a-f-]+\.png$/);

      const filename = json.url.split('/').pop() as string;
      const filePath = path.join(MILESTONE_PHOTOS_DIR, filename);

      // Real filesystem check — not a mock — proving the file genuinely landed on disk.
      expect(fs.existsSync(filePath)).toBe(true);
      const written = fs.readFileSync(filePath);
      expect(written.equals(TINY_PNG)).toBe(true);

      fs.rmSync(filePath, { force: true });
    });

    it('serves the uploaded file publicly (no auth) at its returned URL', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-upload-serve@example.com');
      const boundary = '----uploadTestBoundary2';
      const body = buildMultipartBody(boundary, 'photo', 'baby-smile.webp', 'image/webp', TINY_PNG);

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/uploads/milestone-photos',
        headers: { cookie, 'x-csrf-token': csrfToken, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });

      const { url } = uploadResponse.json();
      const publicPath = new URL(url).pathname;

      const getResponse = await app.inject({ method: 'GET', url: publicPath });

      expect(getResponse.statusCode).toBe(200);

      const filename = publicPath.split('/').pop() as string;
      fs.rmSync(path.join(MILESTONE_PHOTOS_DIR, filename), { force: true });
    });

    it('rejects an unauthenticated upload with 401', async () => {
      const boundary = '----uploadTestBoundary3';
      const body = buildMultipartBody(boundary, 'photo', 'baby-smile.png', 'image/png', TINY_PNG);

      const response = await app.inject({
        method: 'POST',
        url: '/uploads/milestone-photos',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects a non-image file with 400', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-upload-bad-type@example.com');
      const boundary = '----uploadTestBoundary4';
      const body = buildMultipartBody(
        boundary,
        'photo',
        'notes.txt',
        'text/plain',
        Buffer.from('not an image'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/uploads/milestone-photos',
        headers: { cookie, 'x-csrf-token': csrfToken, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().status).toBe('error');
    });

    it('rejects a file over the 5MB limit with a clean 400 JSON error', async () => {
      const { cookie, csrfToken } = await registerAndLogin('parent-upload-too-large@example.com');
      const boundary = '----uploadTestBoundary5';
      const oversizedContent = Buffer.alloc(6 * 1024 * 1024, 1);
      const body = buildMultipartBody(boundary, 'photo', 'huge.png', 'image/png', oversizedContent);

      const response = await app.inject({
        method: 'POST',
        url: '/uploads/milestone-photos',
        headers: { cookie, 'x-csrf-token': csrfToken, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().status).toBe('error');
    });

    it('exposes the upload route in the generated OpenAPI document', async () => {
      const response = await app.inject({ method: 'GET', url: '/docs/json' });
      const openApiDocument = response.json();

      expect(openApiDocument.paths['/uploads/milestone-photos'].post.tags).toContain('Uploads');
    });
  });
});
