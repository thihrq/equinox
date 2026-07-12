import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';

export type CompetitiveSetImportMode = 'dry-run' | 'publish' | 'replace-version' | 'rollback';

export interface CompetitiveSetImportRequest {
  file: string;
  regulationId: string;
  sourceId: string;
  mode: CompetitiveSetImportMode;
  allowEmpty?: boolean;
}

export interface CompetitiveSetLoadResult {
  sourcePath: string;
  fileExists: boolean;
  rawRecordCount: number;
  acceptedForValidationCount: number;
  filteredRecordCount: number;
  emptyReason?:
    | 'file-empty'
    | 'file-not-found'
    | 'missing-file-argument'
    | 'all-records-filtered'
    | 'package-draft-empty';
}

export interface CompetitiveSetImportReport {
  accepted: number;
  rejected: number;
  changed: number;
  duplicated: number;
  quarantined: number;
  mode: CompetitiveSetImportMode;
  readCount: number;
  acceptedCount: number;
  rejectedCount: number;
  writtenCount: number;
  mongoWrites: number;
  dryRun: boolean;
  loadResult: CompetitiveSetLoadResult;
  runContext?: import('../data-audit/AuditRunContext').AuditRunContext;
  sources: Array<import('../data-audit/FileIntegrity').AuditedFileSource>;
  warnings: string[];
  records: Array<CompetitiveSetValidationInput & { status?: string }>;
}
