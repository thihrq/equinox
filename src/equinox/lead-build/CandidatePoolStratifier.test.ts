import { PokemonType } from './TeamDefensiveProfile';
import { stratifyCandidatePool, evaluateCandidateDefensiveContribution } from './CandidatePoolStratifier';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCandidatePoolStratifier() {
  console.log('[Equinox Test] Testando a estratificação do Candidate Pool...');

  const candidatesMock = [
    { species: 'Landorus-Therian', types: ['Ground', 'Flying'] as PokemonType[], moves: ['U-turn', 'Rock Slide'] },
    { species: 'Incineroar', types: ['Fire', 'Dark'] as PokemonType[], moves: ['Fake Out', 'Parting Shot', 'Flare Blitz', 'Knock Off'] },
    { species: 'Ogerpon-Hearthflame', types: ['Grass', 'Fire'] as PokemonType[], moves: ['Ivy Cudgel', 'Spiky Shield', 'Follow Me'] },
    { species: 'Heatran', types: ['Fire', 'Steel'] as PokemonType[], moves: ['Heat Wave', 'Flash Cannon', 'Earth Power', 'Protect'] },
    { species: 'Pelipper', types: ['Water', 'Flying'] as PokemonType[], moves: ['Tailwind', 'Wide Guard', 'Hurricane'] },
    { species: 'Gholdengo', types: ['Steel', 'Ghost'] as PokemonType[], moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot'] },
    { species: 'Raging Bolt', types: ['Electric', 'Dragon'] as PokemonType[], moves: ['Thunderclap', 'Draco Meteor'] },
  ];

  // 1. Teste de Avaliação de Contribuição Defensiva
  const incineroarContrib = evaluateCandidateDefensiveContribution(candidatesMock[1], ['Ice']);
  assert(incineroarContrib.resistedTypes.includes('Ice'), 'Incineroar deve ter resistência registrada a Gelo');
  assert(incineroarContrib.defensiveAnswerScore > 0, 'Score de resposta defensiva do Incineroar deve ser > 0');

  // 2. Teste de Estratificação mantendo cota ofensiva e adicionando respostas defensivas e suporte
  const stratified = stratifyCandidatePool(candidatesMock, { neededWeakTypes: ['Ice'] }, {
    offensiveSynergy: 3,
    defensiveAnswers: 2,
    pivots: 2,
    utility: 2,
    spreadMitigation: 1,
  });

  assert(stratified.length === candidatesMock.length, 'Com poucos candidatos, todos devem ser retidos');

  // 3. Teste de Deduplicação
  const duplicatesInput = [...candidatesMock, candidatesMock[0], candidatesMock[1]];
  const deduplicated = stratifyCandidatePool(duplicatesInput);
  assert(deduplicated.length === candidatesMock.length, 'Candidatos duplicados na fonte devem ser deduplicados no resultado');

  console.log('✅ Testes do CandidatePoolStratifier passaram com sucesso!');
}

if (require.main === module) {
  testCandidatePoolStratifier();
}
