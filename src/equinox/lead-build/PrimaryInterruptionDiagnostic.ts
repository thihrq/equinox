export type PrimaryInterruptionReason =
  | 'TIME_BUDGET_EXHAUSTED'
  | 'NO_COMPLETE_FINALIST_PRODUCED'
  | 'FINALISTS_REJECTED_BY_QUALITY_GATES'
  | 'SOURCE_CANDIDATES_EXHAUSTED';

export interface PrimaryInterruptionDiagnostic {
  reason: PrimaryInterruptionReason;
  evaluatedCompleteTeamsCount: number;
  partialStatesCount: number;
  missingCapabilityIds: readonly string[];
  interruptedAtMs: number;
}
