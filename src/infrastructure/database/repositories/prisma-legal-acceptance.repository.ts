import { PrismaClient } from '../../../generated/prisma/client';
import { LegalAcceptanceRepository } from '../../../application/legal/legal-acceptance-repository';
import { LegalAcceptance, LegalDocumentId } from '../../../domain/legal/legal-acceptance';

interface LegalAcceptanceRow {
  id: string;
  userId: string;
  documentId: string;
  version: string;
  acceptedAt: Date;
}

function toDomain(row: LegalAcceptanceRow): LegalAcceptance {
  return LegalAcceptance.restore({
    id: row.id,
    userId: row.userId,
    documentId: row.documentId as LegalDocumentId,
    version: row.version,
    acceptedAt: row.acceptedAt,
  });
}

export class PrismaLegalAcceptanceRepository implements LegalAcceptanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllByUserId(userId: string): Promise<LegalAcceptance[]> {
    const rows = await this.prisma.legalAcceptance.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
    });

    return rows.map(toDomain);
  }

  async findByUserDocumentAndVersion(
    userId: string,
    documentId: LegalDocumentId,
    version: string,
  ): Promise<LegalAcceptance | null> {
    const row = await this.prisma.legalAcceptance.findUnique({
      where: { userId_documentId_version: { userId, documentId, version } },
    });

    return row ? toDomain(row) : null;
  }

  async save(acceptance: LegalAcceptance): Promise<void> {
    // Upsert rather than create: the unique index on (user, document, version) is what actually
    // guarantees one row per accepted version, and two requests arriving together would otherwise
    // race past the use case's read and turn a double-tap into a 500.
    await this.prisma.legalAcceptance.upsert({
      where: {
        userId_documentId_version: {
          userId: acceptance.userId,
          documentId: acceptance.documentId,
          version: acceptance.version,
        },
      },
      update: {},
      create: {
        id: acceptance.id,
        userId: acceptance.userId,
        documentId: acceptance.documentId,
        version: acceptance.version,
        acceptedAt: acceptance.acceptedAt,
      },
    });
  }
}
