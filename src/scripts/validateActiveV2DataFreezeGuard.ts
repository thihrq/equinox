import { assertActiveV2DataFreezeAllowsPublication } from '../services/competitive-data/publication/ActiveV2DataFreezeGuard';
import type { ActiveV2CanaryMode } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigTypes';

function phase(mode: ActiveV2CanaryMode, percentage: number | null = null) {
  return { mode, percentage };
}

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: modo 'off' nao esta congelado ---
  const offResult = assertActiveV2DataFreezeAllowsPublication(phase('off'));
  if (offResult.freezeActive) throw new Error("Test 1 failed: expected mode='off' to not freeze publication");

  // --- Caso de Teste 2: modo 'shadow' nao esta congelado (nao afeta trafego real) ---
  const shadowResult = assertActiveV2DataFreezeAllowsPublication(phase('shadow'));
  if (shadowResult.freezeActive) throw new Error("Test 2 failed: expected mode='shadow' to not freeze publication");

  // --- Caso de Teste 3: modo 'full' (pos-rollout) nao esta congelado ---
  const fullResult = assertActiveV2DataFreezeAllowsPublication(phase('full'));
  if (fullResult.freezeActive) throw new Error("Test 3 failed: expected mode='full' to not freeze publication");

  // --- Caso de Teste 4: modo 'internal' bloqueia publicacao sem override ---
  let threwInternal = false;
  try {
    assertActiveV2DataFreezeAllowsPublication(phase('internal'));
  } catch (error) {
    threwInternal = true;
    if (!(error instanceof Error) || !error.message.startsWith('DATA_FREEZE_ACTIVE')) {
      throw new Error(`Test 4 failed: expected DATA_FREEZE_ACTIVE error, got: ${error}`);
    }
  }
  if (!threwInternal) throw new Error("Test 4 failed: expected mode='internal' to block publication without override");

  // --- Caso de Teste 5: modo 'percentage' bloqueia publicacao sem override ---
  let threwPercentage = false;
  try {
    assertActiveV2DataFreezeAllowsPublication(phase('percentage', 25));
  } catch (error) {
    threwPercentage = true;
    if (!(error instanceof Error) || !error.message.includes('percentage:25')) {
      throw new Error(`Test 5 failed: expected error message to mention the phase label, got: ${error}`);
    }
  }
  if (!threwPercentage) throw new Error("Test 5 failed: expected mode='percentage' to block publication without override");

  // --- Caso de Teste 6: override sem justificativa continua bloqueado ---
  let threwEmptyJustification = false;
  try {
    assertActiveV2DataFreezeAllowsPublication(phase('internal'), { emergencyOverride: true, emergencyJustification: '   ' });
  } catch (error) {
    threwEmptyJustification = true;
  }
  if (!threwEmptyJustification) throw new Error('Test 6 failed: expected empty justification to still block publication');

  // --- Caso de Teste 7: override com justificativa valida libera a publicacao ---
  const overriddenResult = assertActiveV2DataFreezeAllowsPublication(phase('internal'), {
    emergencyOverride: true,
    emergencyJustification: 'Correcao emergencial de digest invalido detectado em producao',
  });
  if (!overriddenResult.freezeActive || !overriddenResult.overridden) {
    throw new Error('Test 7 failed: expected a valid emergency override to be accepted and flagged as overridden');
  }

  // --- Caso de Teste 8: justificativa presente mas emergencyOverride=false continua bloqueado ---
  let threwFlagMissing = false;
  try {
    assertActiveV2DataFreezeAllowsPublication(phase('internal'), {
      emergencyOverride: false,
      emergencyJustification: 'motivo valido, mas flag nao foi ligada',
    });
  } catch (error) {
    threwFlagMissing = true;
  }
  if (!threwFlagMissing) throw new Error('Test 8 failed: expected missing emergencyOverride flag to still block publication');

  console.log('[Equinox] Active V2 data freeze guard validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
