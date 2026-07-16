import type { TeamDataCoverage } from '../TeamDataCoverage';

export const ACTIVE_V2_SHADOW_GATE_EXIT_CODE = 1;
export const ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE = 2;
export const ACTIVE_V2_SHADOW_MONGO_EXIT_CODE = 3;

export type ActiveV2ShadowExitCode = 0 | 1 | 2 | 3;
export type ActiveV2ShadowPath = 'current' | 'active-v2-staging';
export type ActiveV2ShadowSourceMode = 'controlled-baseline' | 'mongo-staging-active';
export type ActiveV2ShadowEnginePath = 'current' | 'current-with-explicit-v2-context';
export type ActiveV2ShadowSourceKind = 'controlled-snapshot' | 'mongo-active-staging';
export type ActiveV2ShadowSeedState = 'not-applicable' | 'fixed';
export type ActiveV2ShadowVerificationState = 'unverified' | 'staging-controlled' | 'production-approved';
export type ActiveV2ShadowDiffStatus = 'equal' | 'different' | 'missing-baseline' | 'missing-active-v2' | 'error';

export const REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS = [
  'setDiff',
  'moveDiff',
  'itemDiff',
  'abilityDiff',
  'roleDiff',
  'leadStrategyDiff',
  'selectedLeadStrategyDiff',
  'teamDataCoverageDiff',
  'fullTeamEvaluationDiff',
  'scoreDiff',
  'fallbackDiff',
  'exportDiff',
  'errorDiff',
] as const;

export type ActiveV2ShadowComparatorName = typeof REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS[number];

export interface ActiveV2ShadowBaselineMetadata {
  baselineSourceVersion: string;
  baselineSourceDigest: `sha256-${string}`;
  baselineSourceRecordCount: number;
}

export interface ActiveV2ShadowChangedField {
  field: string;
  baseline: unknown;
  activeV2: unknown;
}

export interface ActiveV2ShadowDiffBlock<T = unknown> {
  status: ActiveV2ShadowDiffStatus;
  baseline: T;
  activeV2: T;
  added: unknown[];
  removed: unknown[];
  changed: ActiveV2ShadowChangedField[];
}

export interface ActiveV2ShadowFullTeamEvaluationEvidence {
  score: number;
  executed: boolean;
}

export interface ActiveV2ShadowPathResult {
  path: ActiveV2ShadowPath;
  sourceMode: ActiveV2ShadowSourceMode;
  enginePath: ActiveV2ShadowEnginePath;
  sourceKind: ActiveV2ShadowSourceKind;
  inputPokemon: [string, string] | string[];
  format: 'champions-reg-mb-doubles';
  teamIdentity: string;
  allowLegendaries: boolean;
  seedState: ActiveV2ShadowSeedState;
  setsConsumed: string[];
  movesUsed: string[];
  itemsUsed: string[];
  abilitiesUsed: string[];
  roles: string[];
  leadStrategies: string[];
  selectedLeadStrategy?: string;
  teamDataCoverage?: TeamDataCoverage;
  fullTeamEvaluation?: ActiveV2ShadowFullTeamEvaluationEvidence;
  score: number;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  exportResult: unknown | null;
  errors: string[];
  durationMs: number;
  competitiveVerificationState: ActiveV2ShadowVerificationState;
}

export interface ActiveV2ShadowScenarioComparison {
  sameScenarioInput: boolean;
  sameFormat: boolean;
  sameTeamIdentity: boolean;
  sameAllowLegendaries: boolean;
  sameSeed: true | 'not-applicable';
  setDiff: ActiveV2ShadowDiffBlock<string[]>;
  moveDiff: ActiveV2ShadowDiffBlock<string[]>;
  itemDiff: ActiveV2ShadowDiffBlock<string[]>;
  abilityDiff: ActiveV2ShadowDiffBlock<string[]>;
  roleDiff: ActiveV2ShadowDiffBlock<string[]>;
  leadStrategyDiff: ActiveV2ShadowDiffBlock<string[]>;
  selectedLeadStrategyDiff: ActiveV2ShadowDiffBlock<string | null>;
  teamDataCoverageDiff: ActiveV2ShadowDiffBlock<unknown>;
  fullTeamEvaluationDiff: ActiveV2ShadowDiffBlock<unknown>;
  scoreDiff: ActiveV2ShadowDiffBlock<number | null>;
  fallbackDiff: ActiveV2ShadowDiffBlock<boolean | null>;
  exportDiff: ActiveV2ShadowDiffBlock<unknown>;
  latencyDiffMs: number;
  latencyDeltaPercent: number;
  errorDiff: ActiveV2ShadowDiffBlock<string[]>;
  errors: string[];
  criticalFieldsPresent: boolean;
  differencesFullyRecorded: boolean;
}

export interface ActiveV2ShadowScenarioResult {
  scenarioId: string;
  baselineResult: ActiveV2ShadowPathResult;
  activeV2Result: ActiveV2ShadowPathResult;
  comparison: ActiveV2ShadowScenarioComparison;
  passed: boolean;
}

export interface ActiveV2ShadowAggregate extends ActiveV2ShadowBaselineMetadata {
  mode: 'active-v2-shadow-comparison';
  targetCollection: 'pokemonsets_v2_staging';
  activeRunId?: string;
  activeV2DataDigest?: string;
  activeV2RecordCount?: number;
  activeV2DataDigestAlgorithm?: 'active-v2-canonical-sha256-v1';
  activeV2SourceRunIds: string[];
  activeV2RecordsMissingRunId: number;
  activeV2SourceStateReproducible: boolean;
  scenarioCount: number;
  scenariosCompared: number;
  scenariosWithBaselineExecution: number;
  scenariosWithActiveV2Execution: number;
  scenariosWithSameInput: number;
  scenariosWithRecordedDifferences: number;
  baselineFallbackUsed: boolean;
  activeV2FallbackUsed: boolean;
  activeV2SourceCollection: 'pokemonsets_v2_staging';
  activeV2RecordsLoaded: number;
  localPilotFallbackUsed: boolean;
  productionCollectionReads: number;
  observedMongoWriteCommands: number;
  observedStagingWriteCommands: number;
  observedProductionWriteCommands: number;
  productionWrites: number;
  recordsWritten: number;
  criticalFieldFailures: number;
  unrecordedDifferenceFailures: number;
  sameEngineComponents: boolean;
  sameScenarioInput: boolean;
  sameFormat: boolean;
  sameTeamIdentity: boolean;
  sameAllowLegendaries: boolean;
  sameSeed: true | 'not-applicable';
  readyForCompetitiveAcceptanceGate: boolean;
}

export interface ActiveV2ShadowReport {
  aggregate: ActiveV2ShadowAggregate;
  scenarios: ActiveV2ShadowScenarioResult[];
}
