import { assertChampionsExpertValidationFlags, assertExpertContractsOnly, getChampionsExpertValidationFlags } from '../services/competitive-data/expert/CompetitiveDoublesExpertPolicy';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectError(env: Record<string, string | undefined>, code: string): void {
  let observed: string | undefined;
  try {
    assertChampionsExpertValidationFlags(env);
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(observed === code, `Expected ${code}, received ${observed ?? 'no error'}`);
}

function expectContractError(env: Record<string, string | undefined>, code: string): void {
  let observed: string | undefined;
  try {
    assertExpertContractsOnly(getChampionsExpertValidationFlags(env));
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(observed === code, `Expected ${code}, received ${observed ?? 'no error'}`);
}

const validEnv = {
  EQUINOX_ENABLE_CHAMPIONS_EXPERT_VALIDATION: 'true',
  EQUINOX_CHAMPIONS_EXPERT_VALIDATION_ONLY: 'true',
  EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'false',
  EQUINOX_ALLOW_DATABASE_WRITES: 'false',
  EQUINOX_CHAMPIONS_REGULATION_ID: 'M-B',
};

const flags = assertChampionsExpertValidationFlags(validEnv);
assert(flags.damageEngine === false && flags.speedEngine === false, 'engines must be disabled by default');
assertExpertContractsOnly(flags);
expectError({ ...validEnv, EQUINOX_ENABLE_CHAMPIONS_EXPERT_VALIDATION: 'false' }, 'CHAMPIONS_EXPERT_VALIDATION_DISABLED');
expectError({ ...validEnv, EQUINOX_CHAMPIONS_EXPERT_VALIDATION_ONLY: 'false' }, 'CHAMPIONS_EXPERT_VALIDATION_MODE_REQUIRED');
expectError({ ...validEnv, EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'true' }, 'CHAMPIONS_EXPERT_NETWORK_MUST_BE_DISABLED');
expectError({ ...validEnv, EQUINOX_ALLOW_DATABASE_WRITES: 'true' }, 'CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
expectError({ ...validEnv, EQUINOX_CHAMPIONS_REGULATION_ID: 'A' }, 'CHAMPIONS_REGULATION_ID_MISMATCH');
expectContractError({ ...validEnv, EQUINOX_ENABLE_DAMAGE_ENGINE: 'true' }, 'CHAMPIONS_EXPERT_ENGINES_MUST_BE_DISABLED_FOR_CONTRACT_CHECK');
assert(getChampionsExpertValidationFlags({ ...validEnv, EQUINOX_CHAMPIONS_EXPERT_VALIDATION_ONLY: 'false' }).validationOnly === false, 'strict boolean parsing failed');
console.log('[Equinox] Champions expert flag tests passed.');
