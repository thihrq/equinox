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

/**
 * Reproduz o empilhamento de fraqueza reportado pelo usuário (ex.: 5-6/6
 * membros fracos a um mesmo tipo sem nenhuma resposta defensiva). Lead e
 * 4 dos 5 candidatos do pool são Grass (fracos a Fire, 2.0x); só um
 * candidato (FireResistMon, tipo Fire) resiste a Fire (0.5x). Sem
 * strategy (scoreCandidateForStrategy nunca é chamado), o desempate cai
 * inteiramente em `usageScore` — os 4 candidatos Grass têm usageScore
 * estritamente maior que o candidato que resiste, então SEM a penalidade
 * o builder greedy escolhe os 4 Grass e deixa o resistente de fora.
 */
export function runWeaknessPenaltyExperimentTest() {
  const builder = new FirstCompleteTeamBuilder();

  const lead: PokemonData[] = [
    { name: 'GrassLead1', types: ['Grass'] } as PokemonData,
    { name: 'GrassLead2', types: ['Grass'] } as PokemonData,
  ];

  const candidates: PokemonData[] = [
    { name: 'FireWeakMon1', types: ['Grass'], usageScore: 54 } as PokemonData,
    { name: 'FireWeakMon2', types: ['Grass'], usageScore: 53 } as PokemonData,
    { name: 'FireWeakMon3', types: ['Grass'], usageScore: 52 } as PokemonData,
    { name: 'FireWeakMon4', types: ['Grass'], usageScore: 51 } as PokemonData,
    { name: 'FireResistMon', types: ['Fire'], usageScore: 50 } as PokemonData,
  ];

  const baseline = builder.build({ lead, candidates });
  assert(baseline !== null, 'Baseline deve retornar um time completo.');
  const baselineNames = baseline!.members.map(m => m.name);
  assert(
    !baselineNames.includes('FireResistMon'),
    `Baseline (sem penalidade) deveria excluir FireResistMon por ter usageScore mais baixo, mas o time foi: ${baselineNames.join(', ')}`,
  );

  const withPenalty = builder.build({ lead, candidates, applyWeaknessPenalty: true });
  assert(withPenalty !== null, 'Com penalidade deve retornar um time completo.');
  const withPenaltyNames = withPenalty!.members.map(m => m.name);
  assert(
    withPenaltyNames.includes('FireResistMon'),
    `Com applyWeaknessPenalty=true, FireResistMon deveria ser incluído para reduzir o empilhamento de Fire, mas o time foi: ${withPenaltyNames.join(', ')}`,
  );

  console.log('✅ FirstCompleteTeamBuilder weakness-penalty experiment test PASS');
}

if (require.main === module) {
  runFirstCompleteTeamBuilderTest();
  runWeaknessPenaltyExperimentTest();
}
