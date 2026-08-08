import { prisma } from '../database/prisma-client';
import { AuditLogger } from './audit-logger';

export const auditLogger = new AuditLogger(prisma);
