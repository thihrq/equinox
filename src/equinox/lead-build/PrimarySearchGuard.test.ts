import { PrimarySearchGuard } from './PrimarySearchGuard';
import { LeadBuildPhaseBudget, RENDER_FREE_PHASE_BUDGET_CONFIG } from './LeadBuildPhaseBudget';
import { MonotonicClock } from './MonotonicClock';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function testPrimarySearchGuardUnit() {
  let currentTime = 1000;
  const mockClock: MonotonicClock = {
    now: () => currentTime,
  };

  const budget = new LeadBuildPhaseBudget(1000, RENDER_FREE_PHASE_BUDGET_CONFIG, mockClock);
  const guard = new PrimarySearchGuard(budget, 4);

  assert(guard.shouldContinue() === true, 'Deve permitir continuar no início.');

  // Advance time past primary deadline (6500ms total = 7500ms timestamp)
  currentTime = 7600;
  assert(guard.shouldContinue() === false, 'Deve parar quando o orçamento da busca primária expirar.');
  assert(guard.interrupted === true, 'Guard deve registrar interrupção.');

  guard.onInterrupted({ stage: 2, beamSize: 10, evaluatedCombinations: 150 });
  assert(budget.getStopReason() === 'PRIMARY_TIME_BUDGET_REACHED', 'Stop reason deve ser PRIMARY_TIME_BUDGET_REACHED.');

  console.log('✅ PrimarySearchGuard unit test passou.');
}

if (require.main === module) {
  testPrimarySearchGuardUnit();
}
