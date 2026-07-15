import type { TeamDataCoverage } from '../TeamDataCoverage';
import { assertSameScenarioInputs, sameSeedState } from './ActiveV2ShadowInputGuards';
import { normalizeShadowPathResult } from './ActiveV2ShadowNormalizer';
import {
  REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS,
  type ActiveV2ShadowDiffBlock,
  type ActiveV2ShadowDiffStatus,
  type ActiveV2ShadowFullTeamEvaluationEvidence,
  type ActiveV2ShadowPathResult,
  type ActiveV2ShadowScenarioComparison,
} from './ActiveV2ShadowTypes';

const DIFF_STATUSES = new Set<ActiveV2ShadowDiffStatus>([
  'equal',
  'different',
  'missing-baseline',
  'missing-active-v2',
  'error',
]);

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown, minimumLength = 0): value is string[] {
  return Array.isArray(value) && value.length >= minimumLength && value.every(item => typeof item === 'string');
}

function isTeamDataCoverage(value: unknown): value is TeamDataCoverage {
  if (!isRecord(value)) return false;
  const numericFields: Array<keyof TeamDataCoverage> = [
    'verifiedSets',
    'reviewedSets',
    'draftSets',
    'generatedFallbacks',
    'legacyFallbacks',
    'unknownSets',
    'confidenceScore',
    'competitiveIndexCap',
  ];
  return numericFields.every(field => isFiniteNumber(value[field]) && Number(value[field]) >= 0)
    && typeof value.verifiedCompetitiveLabel === 'boolean'
    && isStringArray(value.notes);
}

function isFullTeamEvaluation(value: unknown): value is ActiveV2ShadowFullTeamEvaluationEvidence {
  return isRecord(value) && isFiniteNumber(value.score) && value.executed === true;
}

function criticalFieldErrors(label: 'baseline' | 'activeV2', result: ActiveV2ShadowPathResult): string[] {
  const errors: string[] = [];
  const expectedTrace = label === 'baseline'
    ? {
      path: 'current',
      sourceMode: 'controlled-baseline',
      enginePath: 'current',
      sourceKind: 'controlled-snapshot',
    } as const
    : {
      path: 'active-v2-staging',
      sourceMode: 'mongo-staging-active',
      enginePath: 'current-with-explicit-v2-context',
      sourceKind: 'mongo-active-staging',
    } as const;
  if (result.path !== expectedTrace.path) errors.push(`${label}.path`);
  if (result.sourceMode !== expectedTrace.sourceMode) errors.push(`${label}.sourceMode`);
  if (result.enginePath !== expectedTrace.enginePath) errors.push(`${label}.enginePath`);
  if (result.sourceKind !== expectedTrace.sourceKind) errors.push(`${label}.sourceKind`);
  if (result.competitiveVerificationState !== 'staging-controlled') {
    errors.push(`${label}.competitiveVerificationState`);
  }
  if (!isStringArray(result.inputPokemon, 2) || result.inputPokemon.length !== 2) errors.push(`${label}.inputPokemon`);
  if (!isStringArray(result.setsConsumed, 2) || result.setsConsumed.length !== 2) errors.push(`${label}.setsConsumed`);
  if (!isStringArray(result.leadStrategies, 1)) errors.push(`${label}.leadStrategies`);
  if (typeof result.selectedLeadStrategy !== 'string' || result.selectedLeadStrategy.length === 0) {
    errors.push(`${label}.selectedLeadStrategy`);
  } else if (!result.leadStrategies.includes(result.selectedLeadStrategy)) {
    errors.push(`${label}.selectedLeadStrategyNotGenerated`);
  }
  if (!isTeamDataCoverage(result.teamDataCoverage)) errors.push(`${label}.teamDataCoverage`);
  if (!isFullTeamEvaluation(result.fullTeamEvaluation)) errors.push(`${label}.fullTeamEvaluation`);
  if (!isFiniteNumber(result.score)) errors.push(`${label}.score`);
  if (isFullTeamEvaluation(result.fullTeamEvaluation) && result.fullTeamEvaluation.score !== result.score) {
    errors.push(`${label}.fullTeamEvaluationScoreMismatch`);
  }
  if (typeof result.fallbackUsed !== 'boolean') errors.push(`${label}.fallbackUsed`);
  if (!hasOwn(result, 'fallbackReason') || result.fallbackReason === undefined) {
    errors.push(`${label}.fallbackReason`);
  } else if (result.fallbackUsed) {
    if (typeof result.fallbackReason !== 'string' || result.fallbackReason.trim().length === 0) {
      errors.push(`${label}.fallbackReason`);
    }
  } else if (result.fallbackReason !== null) {
    errors.push(`${label}.fallbackReasonWithoutFallback`);
  }
  if (!hasOwn(result, 'exportResult') || result.exportResult === undefined) errors.push(`${label}.exportResult`);
  if (!isStringArray(result.errors)) errors.push(`${label}.errors`);
  if (!isFiniteNumber(result.durationMs) || result.durationMs < 0) errors.push(`${label}.durationMs`);
  return errors.map(field => `missing or invalid critical field: ${field}`);
}

function listDiff(baseline: string[], activeV2: string[]): ActiveV2ShadowDiffBlock<string[]> {
  const baselineSet = new Set(baseline);
  const activeSet = new Set(activeV2);
  const added = activeV2.filter(value => !baselineSet.has(value));
  const removed = baseline.filter(value => !activeSet.has(value));
  return {
    status: added.length === 0 && removed.length === 0 ? 'equal' : 'different',
    baseline,
    activeV2,
    added,
    removed,
    changed: [],
  };
}

function evidenceValue<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function valueDiff<T>(
  baselineInput: T | undefined,
  activeV2Input: T | undefined,
  missingBothIsError = false,
): ActiveV2ShadowDiffBlock<T | null> {
  const baseline = evidenceValue(baselineInput);
  const activeV2 = evidenceValue(activeV2Input);
  const equal = JSON.stringify(baseline) === JSON.stringify(activeV2);
  let status: ActiveV2ShadowDiffStatus;
  if (baseline === null && activeV2 === null && missingBothIsError) status = 'error';
  else if (baseline === null && activeV2 !== null) status = 'missing-baseline';
  else if (baseline !== null && activeV2 === null) status = 'missing-active-v2';
  else status = equal ? 'equal' : 'different';

  return {
    status,
    baseline,
    activeV2,
    added: [],
    removed: [],
    changed: equal ? [] : [{ field: 'value', baseline, activeV2 }],
  };
}

function diffBlockFullyRecorded(value: unknown): boolean {
  if (!isRecord(value) || !DIFF_STATUSES.has(value.status as ActiveV2ShadowDiffStatus)) return false;
  if (!hasOwn(value, 'baseline') || !hasOwn(value, 'activeV2')) return false;
  if (!Array.isArray(value.added) || !Array.isArray(value.removed) || !Array.isArray(value.changed)) return false;
  if (!value.changed.every(change => isRecord(change)
    && typeof change.field === 'string'
    && hasOwn(change, 'baseline')
    && hasOwn(change, 'activeV2'))) return false;

  if (value.status === 'error') return false;
  if (value.status === 'missing-baseline') return value.baseline === null && value.activeV2 !== null;
  if (value.status === 'missing-active-v2') return value.baseline !== null && value.activeV2 === null;
  const equal = JSON.stringify(value.baseline) === JSON.stringify(value.activeV2);
  return value.status === (equal ? 'equal' : 'different');
}

function requiredComparatorsRecorded(comparison: Partial<ActiveV2ShadowScenarioComparison>): boolean {
  return REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS.every(name => diffBlockFullyRecorded(comparison[name]))
    && isFiniteNumber(comparison.latencyDiffMs)
    && isFiniteNumber(comparison.latencyDeltaPercent);
}

export function compareShadowPathResults(
  baselineInput: ActiveV2ShadowPathResult,
  activeV2Input: ActiveV2ShadowPathResult,
): ActiveV2ShadowScenarioComparison {
  assertSameScenarioInputs(baselineInput, activeV2Input);
  const criticalErrors = [
    ...criticalFieldErrors('baseline', baselineInput),
    ...criticalFieldErrors('activeV2', activeV2Input),
  ];
  const baseline = normalizeShadowPathResult(baselineInput);
  const activeV2 = normalizeShadowPathResult(activeV2Input);
  const latencyDiffMs = activeV2.durationMs - baseline.durationMs;
  const latencyDeltaPercent = baseline.durationMs === 0 ? 0 : Math.round((latencyDiffMs / baseline.durationMs) * 100);

  const comparison: ActiveV2ShadowScenarioComparison = {
    sameScenarioInput: true,
    sameFormat: true,
    sameTeamIdentity: true,
    sameAllowLegendaries: true,
    sameSeed: sameSeedState(baseline, activeV2),
    setDiff: listDiff(baseline.setsConsumed, activeV2.setsConsumed),
    moveDiff: listDiff(baseline.movesUsed, activeV2.movesUsed),
    itemDiff: listDiff(baseline.itemsUsed, activeV2.itemsUsed),
    abilityDiff: listDiff(baseline.abilitiesUsed, activeV2.abilitiesUsed),
    roleDiff: listDiff(baseline.roles, activeV2.roles),
    leadStrategyDiff: listDiff(baseline.leadStrategies, activeV2.leadStrategies),
    selectedLeadStrategyDiff: valueDiff(baseline.selectedLeadStrategy, activeV2.selectedLeadStrategy, true),
    teamDataCoverageDiff: valueDiff(baseline.teamDataCoverage, activeV2.teamDataCoverage, true),
    fullTeamEvaluationDiff: valueDiff(baseline.fullTeamEvaluation, activeV2.fullTeamEvaluation, true),
    scoreDiff: valueDiff(baseline.score, activeV2.score, true),
    fallbackDiff: valueDiff(baseline.fallbackUsed, activeV2.fallbackUsed, true),
    exportDiff: valueDiff(baseline.exportResult, activeV2.exportResult),
    latencyDiffMs,
    latencyDeltaPercent,
    errorDiff: listDiff(baseline.errors, activeV2.errors),
    errors: criticalErrors,
    criticalFieldsPresent: criticalErrors.length === 0,
    differencesFullyRecorded: false,
  };

  comparison.differencesFullyRecorded = criticalErrors.length === 0 && requiredComparatorsRecorded(comparison);
  return comparison;
}

const RECOMPUTED_COMPARISON_FIELDS = [
  'sameScenarioInput',
  'sameFormat',
  'sameTeamIdentity',
  'sameAllowLegendaries',
  'sameSeed',
  'latencyDiffMs',
  'latencyDeltaPercent',
  'errors',
] as const satisfies readonly (keyof ActiveV2ShadowScenarioComparison)[];

export interface ActiveV2ShadowRecomputedEvidence {
  criticalFieldsPresent: boolean;
  differencesFullyRecorded: boolean;
}

export function recomputeShadowComparisonEvidence(
  baseline: ActiveV2ShadowPathResult,
  activeV2: ActiveV2ShadowPathResult,
  comparison: ActiveV2ShadowScenarioComparison,
): ActiveV2ShadowRecomputedEvidence {
  let expected: ActiveV2ShadowScenarioComparison;
  try {
    expected = compareShadowPathResults(baseline, activeV2);
  } catch {
    return { criticalFieldsPresent: false, differencesFullyRecorded: false };
  }

  const comparatorEvidenceMatches = REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS.every(
    name => JSON.stringify(comparison[name]) === JSON.stringify(expected[name]),
  );
  const metadataEvidenceMatches = RECOMPUTED_COMPARISON_FIELDS.every(
    name => JSON.stringify(comparison[name]) === JSON.stringify(expected[name]),
  );
  return {
    criticalFieldsPresent: expected.criticalFieldsPresent,
    differencesFullyRecorded: expected.criticalFieldsPresent
      && requiredComparatorsRecorded(comparison)
      && comparatorEvidenceMatches
      && metadataEvidenceMatches,
  };
}
