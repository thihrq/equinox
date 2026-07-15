import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from '../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { readControlledBaselineSource } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';
import { runControlledBaselinePath } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowPathAdapter';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const source = readControlledBaselineSource();
const result = runControlledBaselinePath({
  scenario: ACTIVE_STAGING_HOMOLOGATION_SCENARIOS[0],
  records: source.records,
  teamIdentity: 'balanced',
  allowLegendaries: false,
});

assert(source.records.length > 4, 'controlled source must exercise extra-record filtering');
assert(result.path === 'current', 'baseline path must be current');
assert(result.enginePath === 'current', 'baseline must use current engine logic');
assert(result.sourceKind === 'controlled-snapshot', 'baseline source must be controlled snapshot');
assert(result.fallbackUsed === false, 'baseline controlled source must not be fallback');
assert(result.inputPokemon.length === 2, 'scenario input must contain two Pokemon');
assert(result.setsConsumed.length === 2, 'scenario result must contain two presented Pokemon sets');
assert(result.leadStrategies.length > 0, 'baseline must execute lead strategy generator');
assert(result.durationMs >= 0, 'baseline duration must be recorded');
console.log('[Equinox] Active V2 shadow baseline adapter validation passed.');
