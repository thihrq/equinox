export type SetCoherenceSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type SetCoherenceReason =
  | 'NATURE_OFFENSIVE_STAT_MISMATCH'
  | 'EV_OFFENSIVE_STAT_MISMATCH'
  | 'IV_OFFENSIVE_STAT_MISMATCH'
  | 'UNSUPPORTED_MIXED_ATTACKER'
  | 'CHOICE_ITEM_WITH_PROTECT'
  | 'ASSAULT_VEST_WITH_STATUS_MOVE'
  | 'MOVE_ROLE_MISMATCH'
  | 'ABILITY_STRATEGY_MISMATCH'
  | 'ITEM_STRATEGY_MISMATCH'
  | 'REDUNDANT_MOVESET'
  | 'ZERO_IV_CONFLICT'
  | 'NO_EFFECTIVE_STAB'
  | 'SELF_CONFLICTING_MOVESET';

export interface SetCoherenceIssue {
  reason: SetCoherenceReason;
  severity: SetCoherenceSeverity;
  message: string;
  evidence: Readonly<Record<string, unknown>>;
}

export interface SetCoherenceResult {
  valid: boolean;
  score: number;

  criticalIssues: readonly SetCoherenceIssue[];
  warnings: readonly SetCoherenceIssue[];
  information: readonly SetCoherenceIssue[];
}
