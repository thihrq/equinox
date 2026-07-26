import { calculateEffectiveRecoveryBudget, DEFAULT_LEAD_BUILD_TIME_BUDGET } from './RecoverySearchBudget';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testRecoverySearchBudget() {
  console.log('[Equinox Test] Testando cálculo do orçamento de tempo para recovery...');

  const now = Date.now();
  const budget = calculateEffectiveRecoveryBudget(now, DEFAULT_LEAD_BUILD_TIME_BUDGET);

  assert(budget > 0, 'Orçamento no início da requisição deve ser > 0');
  assert(budget <= DEFAULT_LEAD_BUILD_TIME_BUDGET.configuredRecoveryBudgetMs, 'Orçamento não deve exceder configuredRecoveryBudgetMs');

  // Testar orçamento quando o tempo já expirou
  const expiredTime = Date.now() - 9800;
  const expiredBudget = calculateEffectiveRecoveryBudget(expiredTime, DEFAULT_LEAD_BUILD_TIME_BUDGET);
  assert(expiredBudget === 0, 'Orçamento com tempo insuficiente deve retornar 0');

  console.log('✅ RecoverySearchBudget testado com sucesso!');
}

if (require.main === module) {
  testRecoverySearchBudget();
}
