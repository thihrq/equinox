import { FirstCompleteTeamBuilder } from './FirstCompleteTeamBuilder';
import type { PokemonData } from '../core/AnalysisContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function runFirstCompleteTeamBuilderTest() {
  const builder = new FirstCompleteTeamBuilder();

  const lead: PokemonData[] = [
    { name: 'Charizard-Mega-Y', item: 'Charizardite Y' },
    { name: 'Whimsicott', item: 'Focus Sash' },
  ];

  const candidates: PokemonData[] = [
    { name: 'Heatran', item: 'Leftovers' },
    { name: 'Rillaboom', item: 'Assault Vest' },
    { name: 'Urshifu-Rapid-Strike', item: 'Choice Scarf' },
    { name: 'Landorus-Therian', item: 'Life Orb' },
    { name: 'Ogerpon-Hearthflame', item: 'Hearthflame Mask' },
  ];

  const result = builder.build({ lead, candidates });

  assert(result !== null, 'Builder deve retornar um candidato de time completo.');
  assert(result.members.length === 6, 'Time completo deve conter exatamente 6 membros.');
  assert(result.legalityPrecheckPassed === true, 'Pré-checagem de legalidade deve passar.');
  assert(result.speciesIds.length === 6, 'Todas as 6 espécies devem ser únicas.');

  console.log('✅ FirstCompleteTeamBuilder.test PASS');
}

if (require.main === module) {
  runFirstCompleteTeamBuilderTest();
}
