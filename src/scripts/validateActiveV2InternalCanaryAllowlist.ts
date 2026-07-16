import { loadActiveV2InternalCanaryAllowlist, isActiveV2CanarySubjectAllowlisted } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAllowlist';

const ENV_VAR = 'EQUINOX_ACTIVE_V2_CANARY_SUBJECT_ALLOWLIST';

async function runTests(): Promise<void> {
  const original = process.env[ENV_VAR];

  try {
    // --- Caso de Teste 1: variável ausente produz allowlist vazia ---
    delete process.env[ENV_VAR];
    const emptyAllowlist = loadActiveV2InternalCanaryAllowlist();
    if (emptyAllowlist.size !== 0) throw new Error('Test 1 failed: expected empty allowlist when env var is unset');
    if (isActiveV2CanarySubjectAllowlisted('alice', emptyAllowlist)) throw new Error('Test 1 failed: expected nobody allowlisted by default');

    // --- Caso de Teste 2: lista separada por vírgulas, com espaços, é normalizada ---
    process.env[ENV_VAR] = ' alice, bob ,charlie';
    const allowlist = loadActiveV2InternalCanaryAllowlist();
    if (allowlist.size !== 3) throw new Error(`Test 2 failed: expected 3 entries, got ${allowlist.size}`);
    if (!isActiveV2CanarySubjectAllowlisted('alice', allowlist)) throw new Error('Test 2 failed: expected alice to be allowlisted');
    if (!isActiveV2CanarySubjectAllowlisted('bob', allowlist)) throw new Error('Test 2 failed: expected bob (trimmed) to be allowlisted');
    if (isActiveV2CanarySubjectAllowlisted('mallory', allowlist)) throw new Error('Test 2 failed: expected mallory to NOT be allowlisted');

    // --- Caso de Teste 3: entradas vazias (vírgulas duplicadas) são ignoradas ---
    process.env[ENV_VAR] = 'alice,,bob,';
    const allowlistWithGaps = loadActiveV2InternalCanaryAllowlist();
    if (allowlistWithGaps.size !== 2) throw new Error(`Test 3 failed: expected 2 entries ignoring empty gaps, got ${allowlistWithGaps.size}`);

    console.log('[Equinox] Active V2 internal canary allowlist validation passed.');
  } finally {
    if (original === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = original;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
