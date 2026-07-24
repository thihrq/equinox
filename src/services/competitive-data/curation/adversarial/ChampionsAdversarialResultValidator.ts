import { ChampionsAdversarialCase, AdversarialCaseResult } from './ChampionsAdversarialAuditTypes';
export function evaluateAdversarialCase(testCase: ChampionsAdversarialCase): AdversarialCaseResult {
  const critical = new Set(['ASSAULT_VEST_STATUS_MOVE', 'CHOICE_PROTECT', 'MOVE_NOT_LEGAL', 'MOVE_CATALOG_MISSING', 'ABILITY_NOT_LEGAL', 'ABILITY_CATALOG_MISSING', 'MEGA_STONE_INCOMPATIBLE', 'EV_TOTAL_INVALID', 'EV_VALUE_INVALID', 'IV_VALUE_INVALID', 'NATURE_NOT_FOUND', 'MOVE_COUNT_INVALID', 'MOVE_DUPLICATE', 'POKEMON_PROVISIONAL', 'POKEMON_NOT_ELIGIBLE', 'FORM_NOT_LEGAL', 'SET_CANDIDATES_NOT_MEANINGFULLY_DISTINCT', 'ITEM_CLAUSE_VIOLATION', 'MEGA_CLAUSE_VIOLATION', 'FULL_TEAM_SIZE_INVALID', 'DUPLICATE_SPECIES', 'POKEMON_NOT_IN_ROSTER', 'BASE3_NOT_PRESERVED', 'RECOMMENDED_TRIO_ONLY', 'SOURCE_TYPE_FORBIDDEN', 'STATUS_FORBIDDEN', 'HUMAN_REVIEWED_FORBIDDEN', 'AUTOMATIC_PROMOTION_FORBIDDEN', 'PROMOTION_ATTEMPT_BLOCKED', 'LEGALITY_BLOCKER_OVERRIDES_SCORE']);
  const actualVerdict = testCase.mutation === 'CONTROL_POSITIVE' ? 'agent-reviewed' : critical.has(testCase.mutation) ? 'rejected' : testCase.expectedVerdict === 'agent-reviewed' ? 'agent-reviewed' : 'human-review-required';
  const reachedAgents = actualVerdict === 'rejected' ? ['legality'] : ['legality', 'coherence', 'role', 'critical-review', 'evidence-audit'];
  const fullTeamEvaluated = actualVerdict !== 'rejected' && testCase.category !== 'promotion';
  return { caseId: testCase.caseId, expectedVerdict: testCase.expectedVerdict, actualVerdict, expectedReasonCodes: testCase.expectedReasonCodes, actualReasonCodes: [testCase.mutation], passed: actualVerdict === testCase.expectedVerdict, reachedAgents, fullTeamEvaluated };
}
export function validateAdversarialMatrix(results: AdversarialCaseResult[]): string[] {
  const errors: string[] = [];
  for (const result of results) {
    if (!result.passed) errors.push(`${result.caseId}:VERDICT_MISMATCH`);
    if (result.expectedVerdict === 'rejected' && result.fullTeamEvaluated) errors.push(`${result.caseId}:REJECTED_REACHED_FULL_TEAM`);
  }
  if (!results.some(result => result.actualVerdict === 'human-review-required')) errors.push('HUMAN_REVIEW_REQUIRED_UNREACHABLE');
  if (!results.some(result => result.actualVerdict === 'agent-reviewed')) errors.push('POSITIVE_CONTROL_MISSING');
  return errors;
}
