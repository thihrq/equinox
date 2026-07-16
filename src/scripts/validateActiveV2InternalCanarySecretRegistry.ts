import { loadActiveV2InternalCanarySecrets, findActiveActiveV2CanarySecretsAt } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySecretRegistry';

const ENV_VAR = 'EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS';

async function runTests(): Promise<void> {
  const original = process.env[ENV_VAR];

  try {
    // --- Caso de Teste 1: variável ausente retorna array vazio ---
    delete process.env[ENV_VAR];
    if (loadActiveV2InternalCanarySecrets().length !== 0) throw new Error('Test 1 failed: expected empty array when env var is unset');

    // --- Caso de Teste 2: JSON inválido lança CANARY_HMAC_SECRETS_INVALID ---
    process.env[ENV_VAR] = 'not-json';
    try {
      loadActiveV2InternalCanarySecrets();
      throw new Error('Test 2 failed: expected invalid JSON to throw');
    } catch (error: any) {
      if (!error.message.includes('CANARY_HMAC_SECRETS_INVALID')) throw error;
    }

    // --- Caso de Teste 3: entrada malformada (sem secretId) lança ---
    process.env[ENV_VAR] = JSON.stringify([{ secret: 'x', activeFrom: '2026-01-01T00:00:00.000Z' }]);
    try {
      loadActiveV2InternalCanarySecrets();
      throw new Error('Test 3 failed: expected entry missing secretId to throw');
    } catch (error: any) {
      if (!error.message.includes('CANARY_HMAC_SECRETS_INVALID')) throw error;
    }

    // --- Caso de Teste 4: carga válida com múltiplos segredos ---
    process.env[ENV_VAR] = JSON.stringify([
      { secretId: 'v1', secret: 'secret-v1', activeFrom: '2026-01-01T00:00:00.000Z', activeUntil: '2026-06-01T00:00:00.000Z' },
      { secretId: 'v2', secret: 'secret-v2', activeFrom: '2026-05-01T00:00:00.000Z', activeUntil: null },
    ]);
    const secrets = loadActiveV2InternalCanarySecrets();
    if (secrets.length !== 2) throw new Error('Test 4 failed: expected 2 secrets to be loaded');

    // --- Caso de Teste 5: filtragem por instante -> apenas v1 ativo antes de v2 começar ---
    const activeBeforeRotation = findActiveActiveV2CanarySecretsAt(secrets, new Date('2026-03-01T00:00:00.000Z'));
    if (activeBeforeRotation.map(s => s.secretId).join(',') !== 'v1') {
      throw new Error('Test 5 failed: expected only v1 active before rotation window');
    }

    // --- Caso de Teste 6: dentro da janela de sobreposição, ambos ativos (rotação sem downtime) ---
    const activeDuringOverlap = findActiveActiveV2CanarySecretsAt(secrets, new Date('2026-05-15T00:00:00.000Z'));
    if (activeDuringOverlap.length !== 2) throw new Error('Test 6 failed: expected both secrets active during overlap window');

    // --- Caso de Teste 7: após expiração de v1, apenas v2 ativo ---
    const activeAfterExpiry = findActiveActiveV2CanarySecretsAt(secrets, new Date('2026-07-01T00:00:00.000Z'));
    if (activeAfterExpiry.map(s => s.secretId).join(',') !== 'v2') {
      throw new Error('Test 7 failed: expected only v2 active after v1 expiry');
    }

    console.log('[Equinox] Active V2 internal canary secret registry validation passed.');
  } finally {
    if (original === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = original;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
