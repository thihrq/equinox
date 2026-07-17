import { resolveActiveV2RuntimeServeMode } from '../services/competitive-data/runtime-serve/ActiveV2RuntimeServeFlagResolver';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: flag ausente -> baseline-only (padrão seguro) ---
  const result1 = resolveActiveV2RuntimeServeMode({});
  if (result1 !== 'baseline-only') throw new Error(`Test 1 failed: expected baseline-only when flag is absent, got ${result1}`);

  // --- Caso de Teste 2: flag='false' -> baseline-only ---
  const result2 = resolveActiveV2RuntimeServeMode({ EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED: 'false' });
  if (result2 !== 'baseline-only') throw new Error(`Test 2 failed: expected baseline-only when flag=false, got ${result2}`);

  // --- Caso de Teste 3: flag='true' -> active-v2-serve ---
  const result3 = resolveActiveV2RuntimeServeMode({ EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED: 'true' });
  if (result3 !== 'active-v2-serve') throw new Error(`Test 3 failed: expected active-v2-serve when flag=true, got ${result3}`);

  // --- Caso de Teste 4: valor arbitrário (nem 'true' nem 'false') -> baseline-only ---
  const result4 = resolveActiveV2RuntimeServeMode({ EQUINOX_ACTIVE_V2_RUNTIME_SERVE_ENABLED: 'yes' });
  if (result4 !== 'baseline-only') throw new Error(`Test 4 failed: expected baseline-only for a non-'true' value, got ${result4}`);

  console.log('[Equinox] Active V2 runtime serve flag resolver validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
