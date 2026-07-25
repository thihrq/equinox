import { replenishCandidatePool } from './replenishCandidatePool';
import { createCandidateSearchContext } from './CandidateSearchContext';
import { PokemonData } from '../core/AnalysisContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testReplenishCandidatePool() {
  console.log('[Equinox Test] Testando o reabastecimento do pool utilizável de candidatos...');

  const leadWithMega: PokemonData[] = [
    { name: 'Aggron-Mega', item: 'Aggronite' } as any,
    { name: 'Sinistcha', item: 'Leftovers' } as any,
  ];

  const context = createCandidateSearchContext(leadWithMega, 'champions_reg_m_b_doubles', 'trick_room');

  // Criar 50 candidatos simulados contendo 20 Megas (que devem ser filtradas)
  const rawPool: PokemonData[] = [];
  for (let i = 0; i < 20; i++) {
    rawPool.push({ name: `MegaMon-${i}-Mega`, item: 'Megastone' } as any);
  }
  for (let i = 0; i < 30; i++) {
    rawPool.push({ name: `UsableMon-${i}`, item: `Item-${i}` } as any);
  }

  const result = replenishCandidatePool(rawPool, context, {
    targetUsableCandidates: 25,
    maximumRawCandidates: 60,
    batchSize: 20,
  });

  assert(result.usableCandidates.length === 25, `Esperava 25 candidatos utilizáveis, recebeu ${result.usableCandidates.length}`);
  assert(result.usableCandidates.every(c => !c.name.includes('Mega')), 'Nenhum candidato utilizável pode ser Mega');
  assert(result.rejectionStats.rejectedMega >= 20, 'Deve registrar pelo menos 20 Megas rejeitadas');
  assert(result.rawFetched > 25, 'Deve buscar mais candidatos brutos para compensar as Megas descartadas');

  console.log('✅ Testes de replenishCandidatePool passaram com sucesso!');
}

if (require.main === module) {
  testReplenishCandidatePool();
}
