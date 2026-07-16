import { getActiveV2CanaryPhaseCriteria } from '../services/competitive-data/rollout-governance/ActiveV2CanaryPhaseProgressionPolicy';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: shadow (Fase 3) ---
  const shadow = getActiveV2CanaryPhaseCriteria({ mode: 'shadow', percentage: null });
  if (!shadow) throw new Error('Test 1 failed: expected criteria for mode=shadow');
  if (shadow.minObservationDays !== 7 || shadow.minValidExecutions !== 1000) {
    throw new Error(`Test 1 failed: expected shadow criteria 7d/1000, got ${shadow.minObservationDays}d/${shadow.minValidExecutions}`);
  }
  if (shadow.nextPhase?.mode !== 'internal') throw new Error('Test 1 failed: expected shadow to progress to internal');

  // --- Caso de Teste 2: internal (Fase 5) ---
  const internal = getActiveV2CanaryPhaseCriteria({ mode: 'internal', percentage: null });
  if (!internal) throw new Error('Test 2 failed: expected criteria for mode=internal');
  if (internal.minObservationDays !== 3 || internal.minValidExecutions !== 100) {
    throw new Error(`Test 2 failed: expected internal criteria 3d/100, got ${internal.minObservationDays}d/${internal.minValidExecutions}`);
  }
  if (internal.nextPhase?.mode !== 'percentage' || internal.nextPhase?.percentage !== 5) {
    throw new Error('Test 2 failed: expected internal to progress to percentage:5');
  }

  // --- Caso de Teste 3: percentage 5 -> 10 -> 25 -> 50 -> full (Fases 6-9) ---
  const expectedChain: Array<{ pct: number; days: number; execs: number; nextMode: string; nextPct: number | null }> = [
    { pct: 5, days: 7, execs: 1000, nextMode: 'percentage', nextPct: 10 },
    { pct: 10, days: 5, execs: 2000, nextMode: 'percentage', nextPct: 25 },
    { pct: 25, days: 7, execs: 5000, nextMode: 'percentage', nextPct: 50 },
    { pct: 50, days: 7, execs: 10000, nextMode: 'full', nextPct: null },
  ];
  for (const step of expectedChain) {
    const criteria = getActiveV2CanaryPhaseCriteria({ mode: 'percentage', percentage: step.pct });
    if (!criteria) throw new Error(`Test 3 failed: expected criteria for percentage=${step.pct}`);
    if (criteria.minObservationDays !== step.days || criteria.minValidExecutions !== step.execs) {
      throw new Error(
        `Test 3 failed: percentage=${step.pct} expected ${step.days}d/${step.execs}, got ${criteria.minObservationDays}d/${criteria.minValidExecutions}`
      );
    }
    if (criteria.nextPhase?.mode !== step.nextMode || criteria.nextPhase?.percentage !== step.nextPct) {
      throw new Error(`Test 3 failed: percentage=${step.pct} expected nextPhase mode=${step.nextMode} percentage=${step.nextPct}`);
    }
  }

  // --- Caso de Teste 4: full (Fase 10) e' terminal, sem piso de execucoes ---
  const full = getActiveV2CanaryPhaseCriteria({ mode: 'full', percentage: null });
  if (!full) throw new Error('Test 4 failed: expected criteria for mode=full');
  if (full.minObservationDays !== 14) throw new Error(`Test 4 failed: expected full window 14 days, got ${full.minObservationDays}`);
  if (full.minValidExecutions !== 0) throw new Error('Test 4 failed: expected full to have no volume floor');
  if (full.nextPhase !== null) throw new Error('Test 4 failed: expected full to be terminal (nextPhase = null)');

  // --- Caso de Teste 5: off nao tem janela de observacao propria ---
  const off = getActiveV2CanaryPhaseCriteria({ mode: 'off', percentage: null });
  if (off !== null) throw new Error('Test 5 failed: expected mode=off to have no criteria (not observable)');

  // --- Caso de Teste 6: percentual nao mapeado (fora do adendo) ---
  const unmapped = getActiveV2CanaryPhaseCriteria({ mode: 'percentage', percentage: 99 });
  if (unmapped !== null) throw new Error('Test 6 failed: expected an unmapped percentage to have no criteria');

  console.log('[Equinox] Active V2 canary phase progression policy validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
