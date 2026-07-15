import { compareShadowPathResults } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowComparators';
import type { ActiveV2ShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

function base(overrides: Partial<ActiveV2ShadowPathResult> = {}): ActiveV2ShadowPathResult {
  return {
    path: 'current',
    sourceMode: 'controlled-baseline',
    enginePath: 'current',
    sourceKind: 'controlled-snapshot',
    inputPokemon: ['Sinistcha', 'Aggron-Mega'],
    format: 'champions-reg-mb-doubles',
    teamIdentity: 'balanced',
    allowLegendaries: false,
    seedState: 'not-applicable',
    setsConsumed: ['set-a', 'set-b'],
    movesUsed: ['Protect'],
    itemsUsed: ['Sitrus Berry'],
    abilitiesUsed: ['Hospitality'],
    roles: ['support'],
    leadStrategies: ['trick_room'],
    selectedLeadStrategy: 'trick_room',
    teamDataCoverage: {
      verifiedSets: 2,
      reviewedSets: 0,
      draftSets: 0,
      generatedFallbacks: 0,
      legacyFallbacks: 0,
      unknownSets: 0,
      confidenceScore: 32,
      verifiedCompetitiveLabel: true,
      competitiveIndexCap: 100,
      notes: [],
    },
    fullTeamEvaluation: { score: 10, executed: true },
    score: 10,
    fallbackUsed: false,
    fallbackReason: null,
    exportResult: null,
    errors: [],
    durationMs: 10,
    competitiveVerificationState: 'staging-controlled',
    ...overrides,
  };
}

const comparison = compareShadowPathResults(base(), base({
  path: 'active-v2-staging',
  sourceMode: 'mongo-staging-active',
  enginePath: 'current-with-explicit-v2-context',
  sourceKind: 'mongo-active-staging',
  movesUsed: ['Protect', 'Rage Powder'],
  durationMs: 15,
}));

if (comparison.moveDiff.status !== 'different') throw new Error('move difference must be recorded');
if (comparison.itemDiff.status !== 'equal') throw new Error('equal item diff must still be present');
if (comparison.latencyDiffMs !== 5) throw new Error('latency delta must be recorded');
if (comparison.differencesFullyRecorded !== true) throw new Error('all comparator blocks must be present');
if (comparison.criticalFieldsPresent !== true) throw new Error('valid critical fields must be recognized');
const emittedComparisonInput = JSON.stringify(base());
if (!emittedComparisonInput.includes('"fallbackReason":null')) throw new Error('fallbackReason must survive JSON serialization');
if (!emittedComparisonInput.includes('"exportResult":null')) throw new Error('exportResult must survive JSON serialization');

const selectedStrategyDivergence = compareShadowPathResults(
  base({
    leadStrategies: ['trick_room', 'redirect_setup'],
    selectedLeadStrategy: 'trick_room',
  }),
  base({
    path: 'active-v2-staging',
    sourceMode: 'mongo-staging-active',
    enginePath: 'current-with-explicit-v2-context',
    sourceKind: 'mongo-active-staging',
    leadStrategies: ['trick_room', 'redirect_setup'],
    selectedLeadStrategy: 'redirect_setup',
  }),
);
if (selectedStrategyDivergence.leadStrategyDiff.status !== 'equal') {
  throw new Error('generated strategy arrays must remain equal');
}
if (selectedStrategyDivergence.selectedLeadStrategyDiff.status !== 'different') {
  throw new Error('selected lead strategy divergence must be recorded');
}
if (selectedStrategyDivergence.differencesFullyRecorded !== true) {
  throw new Error('recorded selected strategy divergence must preserve complete evidence');
}

const missingCritical = compareShadowPathResults(
  base({ teamDataCoverage: undefined, fullTeamEvaluation: undefined }),
  base({
    path: 'active-v2-staging',
    sourceMode: 'mongo-staging-active',
    enginePath: 'current-with-explicit-v2-context',
    sourceKind: 'mongo-active-staging',
    teamDataCoverage: undefined,
    fullTeamEvaluation: undefined,
  }),
);
if (missingCritical.criticalFieldsPresent !== false) throw new Error('missing critical fields must be detected');
if (missingCritical.differencesFullyRecorded !== false) throw new Error('missing critical evidence must not be fully recorded');
if (missingCritical.teamDataCoverageDiff.status !== 'error') throw new Error('missing coverage on both paths must be explicit');
if (missingCritical.fullTeamEvaluationDiff.status !== 'error') throw new Error('missing evaluation on both paths must be explicit');
const missingJson = JSON.stringify(missingCritical);
if (!missingJson.includes('"baseline":null')) throw new Error('missing baseline values must survive JSON serialization');
if (!missingJson.includes('"activeV2":null')) throw new Error('missing active V2 values must survive JSON serialization');

const missingSelectedStrategy = compareShadowPathResults(
  base({ selectedLeadStrategy: undefined }),
  base({
    path: 'active-v2-staging',
    sourceMode: 'mongo-staging-active',
    enginePath: 'current-with-explicit-v2-context',
    sourceKind: 'mongo-active-staging',
    selectedLeadStrategy: undefined,
  }),
);
if (missingSelectedStrategy.criticalFieldsPresent !== false) throw new Error('missing selected strategy must be detected');
if (missingSelectedStrategy.differencesFullyRecorded !== false) throw new Error('missing selected strategy must block complete evidence');

const invalidTraceability = compareShadowPathResults(
  base({ sourceMode: 'mongo-staging-active' }),
  base({
    path: 'active-v2-staging',
    sourceMode: 'mongo-staging-active',
    enginePath: 'current-with-explicit-v2-context',
    sourceKind: 'mongo-active-staging',
  }),
);
if (invalidTraceability.criticalFieldsPresent !== false) throw new Error('invalid path traceability must be detected');
if (invalidTraceability.differencesFullyRecorded !== false) throw new Error('invalid path traceability must block complete evidence');

const missingFallbackReasonResult = base();
delete (missingFallbackReasonResult as Partial<ActiveV2ShadowPathResult>).fallbackReason;
const missingFallbackReason = compareShadowPathResults(
  missingFallbackReasonResult,
  base({
    path: 'active-v2-staging',
    sourceMode: 'mongo-staging-active',
    enginePath: 'current-with-explicit-v2-context',
    sourceKind: 'mongo-active-staging',
  }),
);
if (missingFallbackReason.criticalFieldsPresent !== false) throw new Error('missing fallbackReason must be detected');
if (missingFallbackReason.differencesFullyRecorded !== false) throw new Error('missing fallbackReason must block complete evidence');

const missingExportResult = base();
delete (missingExportResult as Partial<ActiveV2ShadowPathResult>).exportResult;
const missingExportEvidence = compareShadowPathResults(
  missingExportResult,
  base({
    path: 'active-v2-staging',
    sourceMode: 'mongo-staging-active',
    enginePath: 'current-with-explicit-v2-context',
    sourceKind: 'mongo-active-staging',
  }),
);
if (missingExportEvidence.criticalFieldsPresent !== false) throw new Error('missing exportResult must be detected');
if (missingExportEvidence.differencesFullyRecorded !== false) throw new Error('missing exportResult must block complete evidence');
console.log('[Equinox] Active V2 shadow comparator validation passed.');
