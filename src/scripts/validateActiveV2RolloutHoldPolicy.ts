import { checkActiveV2RolloutHoldExpiry, ACTIVE_V2_ROLLOUT_HOLD_POLICY_V1 } from '../services/competitive-data/rollout-governance/ActiveV2RolloutHoldPolicy';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: hold recém-iniciado não está expirado ---
  const now = new Date('2026-07-15T00:00:00.000Z');
  const recentCheck = checkActiveV2RolloutHoldExpiry('2026-07-10T00:00:00.000Z', now);
  if (recentCheck.expired) throw new Error('Test 1 failed: expected 5-day-old hold to not be expired');

  // --- Caso de Teste 2: hold exatamente no teto (21 dias) está expirado ---
  const exactCheck = checkActiveV2RolloutHoldExpiry('2026-06-24T00:00:00.000Z', now);
  if (!exactCheck.expired) throw new Error('Test 2 failed: expected 21-day-old hold to be expired');

  // --- Caso de Teste 3: hold além do teto está expirado ---
  const overdueCheck = checkActiveV2RolloutHoldExpiry('2026-06-01T00:00:00.000Z', now);
  if (!overdueCheck.expired) throw new Error('Test 3 failed: expected 44-day-old hold to be expired');

  // --- Caso de Teste 4: política padrão declara o teto de 21 dias ---
  if (ACTIVE_V2_ROLLOUT_HOLD_POLICY_V1.maxHoldDurationDays !== 21) {
    throw new Error('Test 4 failed: expected default policy maxHoldDurationDays to be 21');
  }

  console.log('[Equinox] Active V2 rollout hold policy validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
