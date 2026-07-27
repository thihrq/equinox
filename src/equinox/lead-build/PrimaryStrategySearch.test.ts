import { executePrimaryStrategySearch } from './PrimaryStrategySearch';
import { createLeadBuildRequestContext } from './LeadBuildRequestContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testPrimaryStrategySearch() {
  console.log('[Equinox Test] Testando a busca primária estruturada em passagem única...');

  const ctx = createLeadBuildRequestContext('req-primary-01');
  const mockStrategy = { id: 'sun_offense' } as any;

  const mockInput = {
    lead: [
      { name: 'Charizard-Mega-Y', types: ['Fire', 'Flying'] },
      { name: 'Whimsicott', types: ['Grass', 'Fairy'] },
    ],
    strategy: mockStrategy,
    candidates: [],
    maxCandidatesPerStage: 40,
    format: 'gen9vgc2024',
  } as any;

  const result = executePrimaryStrategySearch({
    input: mockInput,
    strategy: mockStrategy,
    context: ctx,
    resolveCompetitiveTeam: team => team,
  });

  assert(typeof result.completionsGenerated === 'number', 'completionsGenerated deve ser numérico');
  assert(Array.isArray(result.traces), 'traces deve ser um array');

  console.log('✅ PrimaryStrategySearch testado com sucesso!');
}

if (require.main === module) {
  testPrimaryStrategySearch();
}
