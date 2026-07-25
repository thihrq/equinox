import { createCandidateSearchContext } from './CandidateSearchContext';
import { PokemonData } from '../core/AnalysisContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCandidateSearchContext() {
  console.log('[Equinox Test] Testando a criação do CandidateSearchContext...');

  const leadWithMega: PokemonData[] = [
    { name: 'Aggron-Mega', item: 'Aggronite' } as any,
    { name: 'Sinistcha', item: 'Leftovers' } as any,
  ];

  const ctxMega = createCandidateSearchContext(leadWithMega, 'champions_reg_m_b_doubles', 'trick_room', {
    reasons: ['LIMITED_STAB_COVERAGE', 'INSUFFICIENT_COVERAGE'],
  } as any);

  assert(ctxMega.megaAlreadyUsed === true, 'Deve detectar Mega na lead');
  assert(ctxMega.existingSpecies.has('aggron'), 'Deve conter aggron em existingSpecies');
  assert(ctxMega.existingSpecies.has('sinistcha'), 'Deve conter sinistcha em existingSpecies');
  assert(ctxMega.existingItems.has('Aggronite'), 'Deve registrar Aggronite');
  assert(ctxMega.existingItems.has('Leftovers'), 'Deve registrar Leftovers');
  assert(ctxMega.missingOffensiveDimensions.includes('stab_coverage'), 'Deve mapear stab_coverage');
  assert(ctxMega.missingOffensiveDimensions.includes('offensive_coverage'), 'Deve mapear offensive_coverage');

  const leadWithoutMega: PokemonData[] = [
    { name: 'Incineroar', item: 'Sitrus Berry' } as any,
    { name: 'Rillaboom', item: 'Assault Vest' } as any,
  ];

  const ctxNoMega = createCandidateSearchContext(leadWithoutMega, 'champions_reg_m_b_doubles', 'balanced');
  assert(ctxNoMega.megaAlreadyUsed === false, 'Não deve marcar megaAlreadyUsed para lead comum');
  assert(ctxNoMega.existingSpecies.has('incineroar'), 'Deve conter incineroar em existingSpecies');

  console.log('✅ Testes de CandidateSearchContext passaram com sucesso!');
}

if (require.main === module) {
  testCandidateSearchContext();
}
