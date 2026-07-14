import {
  ActiveStagingRepositoryFunctionalGateError,
  activeStagingRepositoryExitCodeFor,
  assertActiveStagingRepositoryFunctionalGates,
  createActiveStagingMongoClient,
} from '../equinox/competitive/active-staging/ActiveStagingRepositoryValidation';
import { ActiveStagingConfigError } from '../equinox/competitive/active-staging/ActiveStagingHomologationConfig';
import {
  ACTIVE_STAGING_CONFIG_EXIT_CODE,
  ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE,
  ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
} from '../equinox/competitive/active-staging/ActiveStagingHomologationTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertFunctionalGateFailure(action: () => void, message: string): void {
  try {
    action();
    throw new Error(`${message} must fail`);
  } catch (error) {
    assert(error instanceof ActiveStagingRepositoryFunctionalGateError, `${message} must be a functional gate error`);
    assert(activeStagingRepositoryExitCodeFor(error) === ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE, `${message} must exit 1`);
  }
}

assert(
  activeStagingRepositoryExitCodeFor(new ActiveStagingConfigError('missing Mongo URI')) === ACTIVE_STAGING_CONFIG_EXIT_CODE,
  'configuration failures must exit 2',
);
assert(
  activeStagingRepositoryExitCodeFor(new ActiveStagingRepositoryFunctionalGateError('missing allowlisted record')) === ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE,
  'functional gate failures must exit 1',
);
assert(
  activeStagingRepositoryExitCodeFor(new Error('Mongo connection failed')) === ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
  'Mongo connection and read failures must exit 3',
);

assertFunctionalGateFailure(() => assertActiveStagingRepositoryFunctionalGates(3, 4, 0, 0, 0), 'missing allowlisted records');
assertFunctionalGateFailure(() => assertActiveStagingRepositoryFunctionalGates(4, 4, 1, 0, 0), 'detected writes');
assertFunctionalGateFailure(() => assertActiveStagingRepositoryFunctionalGates(4, 4, 0, 1, 0), 'command monitor production read');
assertFunctionalGateFailure(() => assertActiveStagingRepositoryFunctionalGates(4, 4, 0, 0, 1), 'collection monitor production read');

try {
  createActiveStagingMongoClient('not-a-mongo-uri');
  throw new Error('malformed Mongo URI must fail');
} catch (error) {
  assert(error instanceof ActiveStagingConfigError, 'malformed Mongo URI must be a configuration error');
  assert(activeStagingRepositoryExitCodeFor(error) === ACTIVE_STAGING_CONFIG_EXIT_CODE, 'malformed Mongo URI must exit 2');
}

console.log('[Equinox] Active staging repository exit-code validation passed.');
