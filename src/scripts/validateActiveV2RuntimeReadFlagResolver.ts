import { resolveActiveV2RuntimeReadMode } from '../services/competitive-data/runtime-read/ActiveV2RuntimeReadFlagResolver';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: flag ausente -> baseline-only (padrão seguro) ---
  if (resolveActiveV2RuntimeReadMode({}) !== 'baseline-only') {
    throw new Error('Test 1 failed: expected baseline-only when flag is unset');
  }

  // --- Caso de Teste 2: flag com valor diferente de "true" -> baseline-only ---
  if (resolveActiveV2RuntimeReadMode({ EQUINOX_ACTIVE_V2_RUNTIME_READ_ENABLED: 'yes' }) !== 'baseline-only') {
    throw new Error('Test 2 failed: expected baseline-only for a non-"true" value');
  }

  // --- Caso de Teste 3: flag = "true" -> active-v2-read ---
  if (resolveActiveV2RuntimeReadMode({ EQUINOX_ACTIVE_V2_RUNTIME_READ_ENABLED: 'true' }) !== 'active-v2-read') {
    throw new Error('Test 3 failed: expected active-v2-read when flag is "true"');
  }

  console.log('[Equinox] Active V2 runtime read flag resolver validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
