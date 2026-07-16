import { classifyActiveV2CanaryTransition } from '../services/competitive-data/runtime-control/ActiveV2CanaryTransitionPolicy';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: off/shadow/internal exigem 1 responsável ---
  for (const mode of ['off', 'shadow', 'internal'] as const) {
    const req = classifyActiveV2CanaryTransition(mode, null);
    if (req.requiredApproverCount !== 1 || req.tier !== 'single-responsible') {
      throw new Error(`Test 1 failed: expected mode=${mode} to require 1 approver (single-responsible)`);
    }
  }

  // --- Caso de Teste 2: 0->5% e 5->10% exigem revisão registrada (1 aprovador) ---
  const req5 = classifyActiveV2CanaryTransition('percentage', 5);
  const req10 = classifyActiveV2CanaryTransition('percentage', 10);
  if (req5.requiredApproverCount !== 1 || req5.tier !== 'registered-review') throw new Error('Test 2 failed: expected 5% to be registered-review with 1 approver');
  if (req10.requiredApproverCount !== 1 || req10.tier !== 'registered-review') throw new Error('Test 2 failed: expected 10% to be registered-review with 1 approver');

  // --- Caso de Teste 3: acima de 10% exige duas pessoas ---
  const req25 = classifyActiveV2CanaryTransition('percentage', 25);
  const req50 = classifyActiveV2CanaryTransition('percentage', 50);
  if (req25.requiredApproverCount !== 2 || req25.tier !== 'two-person') throw new Error('Test 3 failed: expected 25% to require two-person approval');
  if (req50.requiredApproverCount !== 2 || req50.tier !== 'two-person') throw new Error('Test 3 failed: expected 50% to require two-person approval');

  // --- Caso de Teste 4: full (100%) exige aprovação executiva + duas pessoas ---
  const reqFull = classifyActiveV2CanaryTransition('full', null);
  if (reqFull.requiredApproverCount !== 2 || !reqFull.requiresExecutiveApproval || reqFull.tier !== 'executive') {
    throw new Error('Test 4 failed: expected full mode to require executive + two-person approval');
  }

  // --- Caso de Teste 5: percentage sem valor numérico lança erro de configuração ---
  try {
    classifyActiveV2CanaryTransition('percentage', null);
    throw new Error('Test 5 failed: expected error for percentage=null');
  } catch (error: any) {
    if (!error.message.includes('CANARY_TRANSITION_INVALID')) throw error;
  }

  console.log('[Equinox] Active V2 canary transition policy validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
