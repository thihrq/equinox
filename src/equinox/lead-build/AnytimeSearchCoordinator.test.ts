import { AnytimeSearchCoordinator } from './AnytimeSearchCoordinator';
import { createLeadBuildRequestContext } from './LeadBuildRequestContext';
import type { PokemonData } from '../core/AnalysisContext';
import type { LeadStrategyCandidate } from '../vgc/LeadBuildTypes';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export async function runAnytimeSearchCoordinatorTest() {
  const coordinator = new AnytimeSearchCoordinator();
  const context = createLeadBuildRequestContext('req-test-anytime-coord-1');

  const lead: PokemonData[] = [
    { name: 'Charizard-Mega-Y', item: 'Charizardite Y' },
    { name: 'Whimsicott', item: 'Focus Sash' },
  ];

  const strategies: LeadStrategyCandidate[] = [
    { id: 'sun_offense', name: 'Sun Offense', objective: 'Sun', lead: ['Charizard-Mega-Y', 'Whimsicott'], turnOneOptions: [], primarySynergy: 'Sun', resolvedProfile: { profileId: 'weather', matchedTraits: [], confidence: 100, fallbackUsed: false }, requiredRoles: [], optionalRoles: [], archetype: 'Sun', feasibilityScore: 90 } as any,
    { id: 'tailwind_rush', name: 'Tailwind Rush', objective: 'Speed', lead: ['Charizard-Mega-Y', 'Whimsicott'], turnOneOptions: [], primarySynergy: 'Tailwind', resolvedProfile: { profileId: 'tailwind', matchedTraits: [], confidence: 100, fallbackUsed: false }, requiredRoles: [], optionalRoles: [], archetype: 'Tailwind', feasibilityScore: 85 } as any,
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
    format: 'champions_reg_m_b_doubles',
    requestContext: context,
    startedAtMs: 0,
    globalDeadlineMs: 9000,
    nowMs: () => {
      mockTime += 50;
      return mockTime;
    },
  });

  assert(result.acceptedTeams.length >= 0, 'Execucao concluida.');
  assert(allEligibleStrategiesReceivedFirstPass === true, 'Todas as estratégias elegíveis devem receber ao menos uma passagem inicial.');
  assert(roundResults.length === 2, 'Deve registrar o resultado de ambas as 2 estratégias.');

  console.log('✅ AnytimeSearchCoordinator.test PASS');
}

if (require.main === module) {
  runAnytimeSearchCoordinatorTest()
    .then(() => console.log('Done'))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
