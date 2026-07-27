import { LeadBuildPhaseBudget, RENDER_FREE_PHASE_BUDGET_CONFIG } from './LeadBuildPhaseBudget';
import { MonotonicClock } from './MonotonicClock';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function testPhaseBudgetControlledClockUnit() {
  let currentTime = 1000;
  const mockClock: MonotonicClock = {
    now: () => currentTime,
  };

  const budget = new LeadBuildPhaseBudget(1000, RENDER_FREE_PHASE_BUDGET_CONFIG, mockClock);

  // Started at 1000. Total budget = 10000ms. Deadline at 11000.
  // Primary deadline at 1000 + 10000 - 3000 - 500 = 7500ms (elapsed 6500ms).

  // 1. T = 1000ms (0ms elapsed) -> Primary OK
  assert(budget.canContinuePrimary(1000) === true, 'T=1000ms: Busca primária permitida.');

  // 2. T = 6000ms (5000ms elapsed) -> Primary OK
  currentTime = 6000;
  assert(budget.canContinuePrimary(6000) === true, 'T=6000ms (elapsed 5.000ms): Busca primária permitida.');

  // 3. T = 7500ms (6500ms elapsed) -> Recovery start deadline reached (primary stop)
  currentTime = 7500;
  assert(budget.canStartRecovery(7500) === true, 'T=7500ms: Recovery pode iniciar com o tempo reservado protegido.');
  assert(budget.recoveryTimeAvailableMs(7500) >= 3000, `T=7500ms: Tempo disponível para recovery deve ser >= 3.000ms. Atual: ${budget.recoveryTimeAvailableMs(7500)}ms`);

  // 4. T = 7501ms (6501ms elapsed) -> Primary search disabled
  currentTime = 7501;
  assert(budget.canContinuePrimary(7501) === false, 'T=7501ms (elapsed > 6.500ms): Busca primária interrompida.');

  // 5. T = 10501ms (9501ms elapsed) -> Finalization reserve (500ms left)
  currentTime = 10501;
  assert(budget.canStartRecovery(10501) === false, 'T=10501ms: Recovery não pode mais iniciar.');
  assert(budget.mustFinalize(10501) === true, 'T=10501ms: Finalização obrigatória acionada para garantir retorno em < 10s.');

  console.log('✅ PhaseBudgetControlledClock unit test passou.');
}

if (require.main === module) {
  testPhaseBudgetControlledClockUnit();
}
