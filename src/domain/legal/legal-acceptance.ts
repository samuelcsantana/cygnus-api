export type LegalDocumentId = 'privacy' | 'terms';

export interface LegalAcceptanceProps {
  id: string;
  userId: string;
  documentId: LegalDocumentId;
  version: string;
  acceptedAt: Date;
}

export interface RecordLegalAcceptanceProps {
  id: string;
  userId: string;
  documentId: LegalDocumentId;
  version: string;
  acceptedAt?: Date;
}

/**
 * That a user accepted one version of one legal document, and when.
 *
 * The version is part of the identity of the acceptance, not an attribute of it. Consent to a text
 * that has since been rewritten is not consent to the current one, so raising a document's version
 * is what makes everyone accept again — and what keeps this from being a boolean nobody can date.
 */
export class LegalAcceptance {
  readonly id: string;
  readonly userId: string;
  readonly documentId: LegalDocumentId;
  readonly version: string;
  readonly acceptedAt: Date;

  private constructor(props: LegalAcceptanceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.documentId = props.documentId;
    this.version = props.version;
    this.acceptedAt = props.acceptedAt;
  }

  static record(props: RecordLegalAcceptanceProps): LegalAcceptance {
    return new LegalAcceptance({
      id: props.id,
      userId: props.userId,
      documentId: props.documentId,
      version: props.version,
      acceptedAt: props.acceptedAt ?? new Date(),
    });
  }

  static restore(props: LegalAcceptanceProps): LegalAcceptance {
    return new LegalAcceptance(props);
  }
}
