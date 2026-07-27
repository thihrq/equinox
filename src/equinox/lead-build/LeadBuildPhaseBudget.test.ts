import { LeadBuildPhaseBudget, RENDER_FREE_PHASE_BUDGET_CONFIG } from './LeadBuildPhaseBudget';
import { MonotonicClock } from './MonotonicClock';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function testLeadBuildPhaseBudgetUnit() {
  let currentTime = 1000;
  const mockClock: MonotonicClock = {
    now: () => currentTime,
  };

  const budget = new LeadBuildPhaseBudget(1000, RENDER_FREE_PHASE_BUDGET_CONFIG, mockClock);

  assert(budget.remainingMs(1000) === 10000, 'Orçamento restante inicial deve ser 10.000ms.');
  assert(budget.canContinuePrimary(1000) === true, 'Deve permitir busca primária no início.');
  assert(budget.canStartRecovery(1000) === true, 'Deve permitir recovery no início.');

  // Advance time to 6000ms (5000ms elapsed) -> primary search check
  currentTime = 6000;
  assert(budget.canContinuePrimary(6000) === true, 'Deve permitir busca primária antes do deadline de 6.500ms.');

  // Advance time to 7600ms (6600ms elapsed) -> recovery must start by 7500ms (1000 + 10.000 - 3.000 - 500 = 7500)
  currentTime = 7600;
  assert(budget.canContinuePrimary(7600) === false, 'Não deve permitir busca primária após 7.500ms (elapsed 6500ms).');
  assert(budget.canStartRecovery(7600) === true, 'Recovery ainda deve poder iniciar em 7.600ms.');

  // Advance time to 10600ms (9600ms elapsed) -> finalization reserve is 500ms (must start by 10500ms)
  currentTime = 10600;
  assert(budget.canStartRecovery(10600) === false, 'Não deve permitir recovery após 10.500ms.');
  assert(budget.mustFinalize(10600) === true, 'Deve forçar finalização após 10.500ms.');

  console.log('✅ LeadBuildPhaseBudget unit test passou.');
}

if (require.main === module) {
  testLeadBuildPhaseBudgetUnit();
}
