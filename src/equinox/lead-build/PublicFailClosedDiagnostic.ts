import { RejectionReasonAggregate } from './FinalistRejectionAggregator';

export type PublicNoStrategyReasonCode =
  | 'UNANSWERED_TYPE_WEAKNESS'
  | 'NO_SAFE_SWITCH_IN'
  | 'CRITICAL_SPREAD_EXPOSURE'
  | 'MISSING_REQUIRED_ROLE'
  | 'INSUFFICIENT_OFFENSIVE_BALANCE'
  | 'NO_COMPATIBLE_CANDIDATES'
  | 'CANDIDATE_SOURCE_EXHAUSTED'
  | 'RECOVERY_BUDGET_EXHAUSTED'
  | 'ENVIRONMENT_PARITY_INVALID'
  | 'QUALITY_GATES_NOT_SATISFIED';

export interface PublicNoStrategyDiagnostic {
  code: PublicNoStrategyReasonCode;
  count: number;
  attackType?: string;
  strategyId?: string;
  capability?: string;
}

export interface PublicNoStrategyMetadata {
  failClosed: true;
  recoveryAttempted: boolean;
  recoveryExhausted: boolean;
  candidateSourceExhausted: boolean;
  reasons: readonly PublicNoStrategyDiagnostic[];
}

export function projectPublicFailClosedMetadata(
  internalReasons: readonly RejectionReasonAggregate[],
  recoveryAttempted: boolean,
  recoveryExhausted: boolean,
  candidateSourceExhausted: boolean,
): PublicNoStrategyMetadata {
  const publicReasons: PublicNoStrategyDiagnostic[] = [];

  for (const r of internalReasons) {
    if (publicReasons.length >= 5) break;

    let code: PublicNoStrategyReasonCode = 'QUALITY_GATES_NOT_SATISFIED';

    if (r.reasonCode === 'UNANSWERED_REPEATED_WEAKNESS') {
      code = 'UNANSWERED_TYPE_WEAKNESS';
    } else if (r.reasonCode === 'NO_DEFENSIVE_SWITCH_IN') {
      code = 'NO_SAFE_SWITCH_IN';
    } else if (r.reasonCode === 'CRITICAL_SPREAD_EXPOSURE') {
      code = 'CRITICAL_SPREAD_EXPOSURE';
    } else if (r.reasonCode === 'INSUFFICIENT_ROLE_COVERAGE') {
      code = 'MISSING_REQUIRED_ROLE';
    } else if (r.reasonCode === 'INSUFFICIENT_OFFENSIVE_BALANCE') {
      code = 'INSUFFICIENT_OFFENSIVE_BALANCE';
    } else if (r.reasonCode === 'SOURCE_EXHAUSTED') {
      code = 'CANDIDATE_SOURCE_EXHAUSTED';
    }

    publicReasons.push({
      code,
      count: r.count,
      attackType: r.attackType,
    });
  }

  if (publicReasons.length === 0) {
    publicReasons.push({
      code: 'QUALITY_GATES_NOT_SATISFIED',
      count: 1,
    });
  }

  return {
    failClosed: true,
    recoveryAttempted,
    recoveryExhausted,
    candidateSourceExhausted,
    reasons: publicReasons,
  };
}
