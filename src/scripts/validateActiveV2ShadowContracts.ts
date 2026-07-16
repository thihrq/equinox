import {
  ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE,
  ACTIVE_V2_SHADOW_GATE_EXIT_CODE,
  ACTIVE_V2_SHADOW_MONGO_EXIT_CODE,
  REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS,
  type ActiveV2ShadowDiffBlock,
  type ActiveV2ShadowPathResult,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const diff: ActiveV2ShadowDiffBlock<string[]> = {
  status: 'equal',
  baseline: [],
  activeV2: [],
  added: [],
  removed: [],
  changed: [],
};

const pathResult: ActiveV2ShadowPathResult = {
  path: 'current',
  sourceMode: 'controlled-baseline',
  enginePath: 'current',
  sourceKind: 'controlled-snapshot',
  inputPokemon: ['Sinistcha', 'Aggron-Mega'],
  format: 'champions-reg-mb-doubles',
  teamIdentity: 'balanced',
  allowLegendaries: false,
  seedState: 'not-applicable',
  setsConsumed: [],
  movesUsed: [],
  itemsUsed: [],
  abilitiesUsed: [],
  roles: [],
  leadStrategies: [],
  selectedLeadStrategy: undefined,
  teamDataCoverage: undefined,
  fullTeamEvaluation: undefined,
  score: 0,
  fallbackUsed: false,
  fallbackReason: null,
  exportResult: null,
  errors: [],
  durationMs: 0,
  competitiveVerificationState: 'staging-controlled',
};

assert(ACTIVE_V2_SHADOW_GATE_EXIT_CODE === 1, 'gate failures must exit 1');
assert(ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE === 2, 'config failures must exit 2');
assert(ACTIVE_V2_SHADOW_MONGO_EXIT_CODE === 3, 'Mongo failures must exit 3');
assert(diff.status === 'equal', 'diff block must support explicit equal status');
assert(pathResult.fallbackUsed === false, 'controlled baseline must not be fallback');
assert(REQUIRED_ACTIVE_V2_SHADOW_COMPARATORS.length === 13, 'all required comparators must be listed');
console.log('[Equinox] Active V2 shadow contract validation passed.');
