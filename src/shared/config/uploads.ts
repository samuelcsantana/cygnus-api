import path from 'node:path';

// Resolves to the same absolute directory whether running the built `dist/` output (Docker,
// `node dist/main.js`) or the TypeScript source directly in local dev (`tsx watch src/main.ts`):
// this file always lives 3 levels below the project root in both layouts
// (`src/shared/config/uploads.ts` and `dist/shared/config/uploads.js`), so `__dirname` walked up
// 3 levels lands on the project root either way. In the Docker image this matches the
// `WORKDIR /app` the named volume is mounted at (see docker-compose.yml).
export const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
export const MILESTONE_PHOTOS_DIR = path.join(UPLOADS_DIR, 'milestone-photos');
