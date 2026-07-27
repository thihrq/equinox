import { RecoveryCandidateFetcher, RecoveryCandidateQuery } from './RecoveryCandidateFetcher';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export async function testRecoveryCandidateFetcher() {
  console.log('[Equinox Test] Testando o fetcher de candidatos para busca por recuperação...');

  const fetcher = new RecoveryCandidateFetcher();

  const universe = [
    { species: 'Heatran', candidateId: 'heatran', types: ['Steel', 'Fire'] },
    { species: 'Charizard-Mega-Y', candidateId: 'charizard', types: ['Fire', 'Flying'] },
    { species: 'Pelipper', candidateId: 'pelipper', types: ['Water', 'Flying'] },
  ];

  const query: RecoveryCandidateQuery = {
    format: 'gen9vgc2024',
    strategyId: 'sun_offense',
    leadCandidateIds: ['charizard'],
    requiredCapabilities: [
      {
        capability: 'TYPE_RESISTANCE',
        attackType: 'Ice',
        priority: 'CRITICAL',
        minimumDistinctAnswers: 1,
        desiredDistinctAnswers: 2,
        appliesTo: 'BOTH',
        evidenceReasonCodes: ['UNANSWERED_REPEATED_WEAKNESS'],
      },
    ],
    excludedCandidateIds: ['charizard'],
    excludedCapabilityKeys: [],
    maximumRawCandidates: 60,
    maximumUsableCandidates: 16,
  };

  const result = await fetcher.fetchTargetedRecoveryCandidates(query, universe);

  assert(result.usableCandidates.length === 1, 'Deve retornar apenas 1 candidato utilizável (Heatran resiste a Gelo)');
  assert(result.usableCandidates[0].species === 'Heatran', 'O candidato retornado deve ser Heatran');
  console.log('✅ RecoveryCandidateFetcher testado com sucesso!');
}

if (require.main === module) {
  testRecoveryCandidateFetcher().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
