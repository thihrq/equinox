import {
  ACTIVE_STAGING_SUCCESS_EXIT_CODE,
  ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE,
  ACTIVE_STAGING_CONFIG_EXIT_CODE,
  ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
  isCompetitiveVerificationState,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(ACTIVE_STAGING_SUCCESS_EXIT_CODE === 0, 'success exit code must be 0');
assert(ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE === 1, 'functional gate exit code must be 1');
assert(ACTIVE_STAGING_CONFIG_EXIT_CODE === 2, 'config exit code must be 2');
assert(ACTIVE_STAGING_MONGO_READ_EXIT_CODE === 3, 'Mongo read exit code must be 3');
assert(isCompetitiveVerificationState('unverified'), 'unverified must be valid');
assert(isCompetitiveVerificationState('staging-controlled'), 'staging-controlled must be valid');
assert(isCompetitiveVerificationState('production-approved'), 'production-approved must be valid');
assert(!isCompetitiveVerificationState('controlled-true'), 'controlled-true must be invalid');
console.log('[Equinox] Active staging homologation contract validation passed.');
