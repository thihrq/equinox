import { resolveCompetitivePokemonSet } from './CompetitivePokemonSet';
import { evaluateSetCoherence } from '../lead-build/SetCoherenceEvaluator';

const FORMAT = 'champions_reg_m_b_doubles';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

/**
 * Reproduz o achado real de produção (lead Charizard-Mega-Y + Whimsicott):
 * um candidato com moveset misto (dano físico + especial) e uma natureza
 * herdada (ex.: Adamant) que reduz um dos dois stats ofensivos investidos.
 * `resolveCompetitivePokemonSet` só corrigia essa incoerência para perfis
 * puramente `physical`/`special` — `mixed` ficava sem correção mesmo
 * `chooseEvs` investindo 124 EVs em Atk E SpA simultaneamente.
 */
function testMixedProfileCorrectsIncoherentNature(): void {
  const pokemon: any = {
    name: 'Sandslash-Alola',
    types: ['Ice', 'Steel'],
    nature: 'Adamant',
    item: 'Muscle Band',
    ability: 'Slush Rush',
    moves: ['Ice Spinner', 'Iron Head', 'Blizzard', 'Protect'],
    role: 'attacker',
  };

  const set = resolveCompetitivePokemonSet(pokemon, FORMAT, 'database');
  const result = evaluateSetCoherence(set);

  assert(result.valid, `Set deveria ser coerente após correção, mas: ${JSON.stringify(result.criticalIssues)}`);
  assert(set.nature !== 'Adamant', 'Nature Adamant deveria ter sido corrigida para um perfil misto');
  assert(set.evs.atk >= 84 && set.evs.spa >= 84, 'Perfil misto deveria seguir investindo EVs relevantes em Atk e SpA');
}

/**
 * Caso simétrico: natureza herdada reduz Atk (ex.: Modest) num moveset
 * misto que também usa dano físico.
 */
function testMixedProfileCorrectsIncoherentSpecialReducingNature(): void {
  const pokemon: any = {
    name: 'TestMon',
    types: ['Normal'],
    nature: 'Modest',
    item: 'Life Orb',
    ability: 'Adaptability',
    moves: ['Close Combat', 'Shadow Ball', 'Ice Beam', 'Protect'],
    role: 'attacker',
  };

  const set = resolveCompetitivePokemonSet(pokemon, FORMAT, 'database');
  const result = evaluateSetCoherence(set);

  assert(result.valid, `Set deveria ser coerente após correção, mas: ${JSON.stringify(result.criticalIssues)}`);
  assert(set.nature !== 'Modest', 'Nature Modest deveria ter sido corrigida para um perfil misto com dano físico');
}

/** Perfis puramente físico/especial continuam funcionando como antes. */
function testPhysicalProfileStillCorrectsAsBefore(): void {
  const pokemon: any = {
    name: 'Unown',
    types: ['Psychic'],
    nature: 'Timid',
    item: 'Life Orb',
    ability: 'Levitate',
    moves: ['Hidden Power', 'Return', 'Facade', 'Protect'],
    role: 'attacker',
  };

  const set = resolveCompetitivePokemonSet(pokemon, FORMAT, 'database');
  const result = evaluateSetCoherence(set);

  assert(result.valid, `Set deveria ser coerente após correção, mas: ${JSON.stringify(result.criticalIssues)}`);
  assert(set.nature !== 'Timid', 'Nature Timid deveria ter sido corrigida para um perfil físico');
}

function main(): void {
  console.log('🧪 CompetitivePokemonSet: correção de natureza incoerente em perfil misto...');
  testMixedProfileCorrectsIncoherentNature();
  console.log('  ✅ Caso 1 (Adamant + moveset misto com Blizzard) passou');
  testMixedProfileCorrectsIncoherentSpecialReducingNature();
  console.log('  ✅ Caso 2 (Modest + moveset misto com Close Combat) passou');
  testPhysicalProfileStillCorrectsAsBefore();
  console.log('  ✅ Caso 3 (regressão: perfil físico puro ainda corrige) passou');
  console.log('\n✅ Todos os testes de CompetitivePokemonSet passaram.');
}

main();
