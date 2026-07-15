import { assertSameScenarioInputs } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowInputGuards';
import type { ActiveV2ShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

function result(overrides: Partial<ActiveV2ShadowPathResult> = {}): ActiveV2ShadowPathResult {
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
    setsConsumed: [],
    movesUsed: [],
    itemsUsed: [],
    abilitiesUsed: [],
    roles: [],
    leadStrategies: [],
    score: 0,
    fallbackUsed: false,
    fallbackReason: null,
    exportResult: null,
    errors: [],
    durationMs: 0,
    competitiveVerificationState: 'staging-controlled',
    ...overrides,
  };
}

assertSameScenarioInputs(result(), result({ path: 'active-v2-staging', sourceMode: 'mongo-staging-active', enginePath: 'current-with-explicit-v2-context', sourceKind: 'mongo-active-staging' }));

try {
  assertSameScenarioInputs(result(), result({ inputPokemon: ['Incineroar', 'Aggron-Mega'] }));
  throw new Error('different input must fail');
} catch (error) {
  if (!String(error).includes('sameScenarioInput')) throw error;
}

console.log('[Equinox] Active V2 shadow input guard validation passed.');
