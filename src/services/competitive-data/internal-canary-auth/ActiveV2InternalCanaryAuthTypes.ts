export interface ActiveV2InternalCanaryRequestHeaders {
  subject: string;
  /** Epoch milliseconds, como string (valor literal do header). */
  timestamp: string;
  nonce: string;
  signature: string;
}

export interface ActiveV2InternalCanarySecret {
  secretId: string;
  secret: string;
  activeFrom: string;
  /** null = sem expiração definida. */
  activeUntil: string | null;
}

export type ActiveV2InternalCanaryDenialReason =
  | 'MISSING_HEADERS'
  | 'TIMESTAMP_OUT_OF_WINDOW'
  | 'SUBJECT_NOT_ALLOWLISTED'
  | 'NO_ACTIVE_SECRET'
  | 'INVALID_SIGNATURE'
  | 'NONCE_ALREADY_USED'
  | 'RATE_LIMIT_EXCEEDED';

export interface ActiveV2InternalCanaryValidationResult {
  authorized: boolean;
  subject: string | null;
  denialReason: ActiveV2InternalCanaryDenialReason | null;
  validatedAt: string;
}
