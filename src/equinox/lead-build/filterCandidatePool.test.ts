import { filterCandidatePool } from './filterCandidatePool';
import { createCandidateSearchContext } from './CandidateSearchContext';
import { PokemonData } from '../core/AnalysisContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testFilterCandidatePool() {
  console.log('[Equinox Test] Testando a filtragem rígida antecipada do pool de candidatos...');

  const leadWithMega: PokemonData[] = [
    { name: 'Aggron-Mega', item: 'Aggronite' } as any,
    { name: 'Sinistcha', item: 'Leftovers' } as any,
  ];

  const context = createCandidateSearchContext(leadWithMega, 'champions_reg_m_b_doubles', 'trick_room');

  const rawCandidates: PokemonData[] = [
    { name: 'Charizard-Mega-Y', item: 'Charizardite Y' } as any, // deve ser rejeitado (Mega)
    { name: 'Sinistcha', item: 'Life Orb' } as any,             // deve ser rejeitado (Species)
    { name: 'Amoonguss', item: 'Leftovers' } as any,           // deve ser rejeitado (Item)
    { name: 'Ursaluna', item: 'Flame Orb' } as any,            // deve ser aceito
    { name: 'Kingambit', item: 'Black Glasses' } as any,       // deve ser aceito
  ];

  const result = filterCandidatePool(rawCandidates, context);

  assert(result.accepted.length === 2, `Esperava 2 candidatos aceitos, recebeu ${result.accepted.length}`);
  assert(result.accepted.some(c => c.name === 'Ursaluna'), 'Ursaluna deve estar aceito');
  assert(result.accepted.some(c => c.name === 'Kingambit'), 'Kingambit deve estar aceito');
  assert(result.accepted.every(c => !c.name.includes('Mega')), 'Nenhum Mega deve passar se Mega já foi usada');

  assert(result.stats.rejectedMega === 1, `stat rejectedMega deve ser 1, recebeu ${result.stats.rejectedMega}`);
  assert(result.stats.rejectedSpecies === 1, `stat rejectedSpecies deve ser 1, recebeu ${result.stats.rejectedSpecies}`);
  assert(result.stats.rejectedItem === 1, `stat rejectedItem deve ser 1, recebeu ${result.stats.rejectedItem}`);

  console.log('✅ Testes de filterCandidatePool passaram com sucesso!');
}

if (require.main === module) {
  testFilterCandidatePool();
}
