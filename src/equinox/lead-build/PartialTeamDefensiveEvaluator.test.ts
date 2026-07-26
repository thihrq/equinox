import { PokemonType } from './TeamDefensiveProfile';
import { evaluatePartialTeamDefensiveQuality } from './PartialTeamDefensiveEvaluator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testPartialTeamDefensiveEvaluator() {
  console.log('[Equinox Test] Testando a avaliação defensiva parcial do feixe de busca...');

  // 1. Três fraquezas e 2 slots com candidatos disponíveis -> Penalizado, mas NÃO podado
  const team3Weak = [
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
  ];
  const candidatesAvailable = [
    { types: ['Fire', 'Dark'] as PokemonType[] }, // Incineroar (resiste a Gelo)
    { types: ['Steel'] as PokemonType[] },
  ];
  const res1 = evaluatePartialTeamDefensiveQuality(team3Weak, 2, candidatesAvailable);
  assert(res1.pruned === false, '3 fraquezas com 2 slots restantes e candidatos disponíveis NÃO deve ser podado');
  assert(res1.totalPenalty > 0, 'Deve ter penalidade incremental para 3 fraquezas sem resposta atual');

  // 2. Quatro fraquezas e 1 slot com candidato resistente no pool -> NÃO podado
  const team4Weak = [
    { types: ['Dragon', 'Flying'] as PokemonType[] }, // 4x fraco
    { types: ['Grass', 'Fairy'] as PokemonType[] },   // 2x fraco
    { types: ['Ground', 'Fighting'] as PokemonType[] },// 2x fraco
    { types: ['Grass', 'Poison'] as PokemonType[] },  // 2x fraco
  ];
  const res2 = evaluatePartialTeamDefensiveQuality(team4Weak, 1, candidatesAvailable);
  assert(res2.pruned === false, '4 fraquezas com 1 slot restante e resposta disponível no pool NÃO deve ser podado');

  // 3. Quatro fraquezas, 1 slot restante, mas NENHUM candidato resistente no pool -> PODADO (pruned = true)
  const candidatesNoIceResist = [
    { types: ['Electric', 'Normal'] as PokemonType[] },
    { types: ['Dragon', 'Ground'] as PokemonType[] },
  ];
  const res3 = evaluatePartialTeamDefensiveQuality(team4Weak, 1, candidatesNoIceResist);
  assert(res3.pruned === true, '4 fraquezas sem slot/resposta disponível no pool DEVE ser podado');

  // 4. Cinco fraquezas e 0 slots -> DEVE ser podado
  const team5Weak = [
    { types: ['Dragon', 'Flying'] as PokemonType[] },
    { types: ['Grass', 'Fairy'] as PokemonType[] },
    { types: ['Ground', 'Fighting'] as PokemonType[] },
    { types: ['Grass', 'Poison'] as PokemonType[] },
    { types: ['Electric', 'Ground'] as PokemonType[] },
    { types: ['Grass', 'Dark'] as PokemonType[] },
  ];
  const res4 = evaluatePartialTeamDefensiveQuality(team5Weak, 0, candidatesAvailable);
  assert(res4.pruned === true, '5 fraquezas com 0 slots DEVE ser podado');

  // 5. Ground com imunidades (2 imunidades a Ground) -> NÃO podar
  const teamGroundImm = [
    { types: ['Fire', 'Flying'] as PokemonType[] },
    { types: ['Dragon', 'Flying'] as PokemonType[] },
    { types: ['Fire', 'Rock'] as PokemonType[] },
    { types: ['Electric', 'Steel'] as PokemonType[] },
  ];
  const res5 = evaluatePartialTeamDefensiveQuality(teamGroundImm, 2, candidatesAvailable);
  const groundExp = res5.exposures.find(e => e.attackType === 'Ground');
  assert(groundExp?.prune === false, 'Fraquezas com imunidades a Ground NÃO devem ser podadas');

  console.log('✅ Testes do PartialTeamDefensiveEvaluator passaram com sucesso!');
}

if (require.main === module) {
  testPartialTeamDefensiveEvaluator();
}
