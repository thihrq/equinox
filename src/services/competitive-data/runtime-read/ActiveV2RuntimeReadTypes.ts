import type { CompetitiveSetValidationInput } from '../../../equinox/data-validation/CompetitiveValidationTypes';
import type { ActiveV2RuntimeManifestHealthSnapshot } from '../runtime-observability/ActiveV2RuntimeTelemetryTypes';

export type ActiveV2RuntimeReadMode = 'active-v2-read' | 'baseline-only';

export type ActiveV2RuntimeReadRejectionReason =
  | 'MANIFEST_HEALTH_ISSUE'
  | 'SCHEMA_INVALID'
  | 'INCOMPLETE_ACTIVE_SET'
  | 'LEGACY_COLLECTION_ACCESSED';

export interface ActiveV2RuntimeReadRecordIssue {
  setId: string;
  reason: ActiveV2RuntimeReadRejectionReason;
  detail: string;
}

export interface ActiveV2RuntimeReadHomologationResult {
  mode: ActiveV2RuntimeReadMode;
  approved: boolean;
  recordCount: number;
  manifestHealth: ActiveV2RuntimeManifestHealthSnapshot | null;
  recordIssues: ActiveV2RuntimeReadRecordIssue[];
  legacyCollectionAccessed: boolean;
  writesAttempted: boolean;
  generatedAt: string;
}

export type { CompetitiveSetValidationInput };
