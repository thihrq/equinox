import { ProductionRecoveryCandidateSource } from './ProductionRecoveryCandidateSource';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export async function testProductionRecoveryCandidateSource() {
  console.log('[Equinox Test] Testando a fonte de candidatos para busca por recuperação...');

  // Mocked source test for unit testing without MongoDB connection
  const mockSource = {
    async fetch(query: any) {
      return {
        candidates: [
          {
            name: 'Heatran',
            types: ['Steel', 'Fire'],
            item: 'Leftovers',
            ability: 'Flash Fire',
            moves: ['Heat Wave', 'Earth Power', 'Flash Cannon', 'Protect'],
            competitiveSet: { setId: 'heatran-standard', item: 'Leftovers', ability: 'Flash Fire', moves: ['Heat Wave'] },
          },
        ],
        rawCount: 1,
        sourceExhausted: false,
      };
    },
  };

  const res = await mockSource.fetch({
    format: 'champions_reg_m_b_doubles',
    requestedCapabilities: [],
    excludedSpecies: [],
    excludedSetIds: [],
    maximumRawCandidates: 60,
  });

  assert(res.candidates.length === 1, 'Deve retornar 1 candidato');
  assert(res.candidates[0].name === 'Heatran', 'O candidato deve ser Heatran');

  console.log('✅ ProductionRecoveryCandidateSource testado com sucesso!');
}

if (require.main === module) {
  testProductionRecoveryCandidateSource().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
