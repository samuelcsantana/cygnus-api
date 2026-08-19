import { PrismaClient } from '../../generated/prisma/client';
import { logger } from '../../shared/logging/logger';

export interface AuditLogEntry {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  babyId?: string | null;
}

// Fire-and-forget: callers never await this on the request/response path — a slow or failing
// audit write must not delay or break the actual health-data mutation it's logging.
export class AuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  log(entry: AuditLogEntry): void {
    void this.prisma.auditLog
      .create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          babyId: entry.babyId ?? null,
        },
      })
      .catch((error: unknown) => {
        logger.error({ err: error, entry }, 'audit_log.write_failed');
      });
  }
}
