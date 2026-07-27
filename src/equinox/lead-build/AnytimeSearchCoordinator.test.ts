import { AnytimeSearchCoordinator } from './AnytimeSearchCoordinator';
import type { PokemonData } from '../core/AnalysisContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function runAnytimeSearchCoordinatorTest() {
  const coordinator = new AnytimeSearchCoordinator();

  const lead: PokemonData[] = [
    { name: 'Charizard-Mega-Y', item: 'Charizardite Y' },
    { name: 'Whimsicott', item: 'Focus Sash' },
  ];

  const strategies = [
    { id: 'sun_offense', profileId: 'weather' },
    { id: 'tailwind_rush', profileId: 'tailwind' },
  ];

  const candidates: PokemonData[] = [
    { name: 'Heatran', item: 'Leftovers' },
    { name: 'Rillaboom', item: 'Assault Vest' },
    { name: 'Urshifu-Rapid-Strike', item: 'Choice Scarf' },
    { name: 'Landorus-Therian', item: 'Life Orb' },
  ];

  let mockTime = 1000;
  const { result, roundResults, allEligibleStrategiesReceivedFirstPass } = await coordinator.executeSearch({
    lead,
    strategies,
    candidates,
    startedAtMs: 0,
    globalDeadlineMs: 9000,
    nowMs: () => {
      mockTime += 50;
      return mockTime;
    },
  });

  assert(result.acceptedTeams.length >= 1, 'Deve aceitar ao menos 1 time completo.');
  assert(allEligibleStrategiesReceivedFirstPass === true, 'Todas as estratégias elegíveis devem receber ao menos uma passagem inicial.');
  assert(roundResults.length === 2, 'Deve registrar o resultado de ambas as 2 estratégias.');

  console.log('✅ AnytimeSearchCoordinator.test PASS');
}

if (require.main === module) {
  runAnytimeSearchCoordinatorTest();
}
