import { StrategyRoundRobinScheduler } from './StrategyRoundRobinScheduler';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function runStrategyRoundRobinSchedulerTest() {
  const scheduler = new StrategyRoundRobinScheduler(800);

  const items = [
    { strategyId: 'sun_offense', eligible: true },
    { strategyId: 'tailwind_rush', eligible: true },
    { strategyId: 'disabled_strat', eligible: false },
  ];

  const scheduled = scheduler.scheduleFirstPass(items);
  assert(scheduled.length === 2, 'Apenas estratégias elegíveis devem ser agendadas.');
  assert(scheduled[0].strategyId === 'sun_offense', 'Primeira estratégia deve ser sun_offense.');
  assert(scheduled[1].strategyId === 'tailwind_rush', 'Segunda estratégia deve ser tailwind_rush.');

  const slice = scheduler.calculateTimeSlice(0, 5000, 1000);
  assert(slice === 800, 'Fatia de tempo deve ser 800ms.');

  console.log('✅ StrategyRoundRobinScheduler.test PASS');
}

if (require.main === module) {
  runStrategyRoundRobinSchedulerTest();
}
