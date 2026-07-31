import { resolveCompetitivePokemonSet } from './CompetitivePokemonSet';
import { evaluateSetCoherence } from '../lead-build/SetCoherenceEvaluator';
import { PokemonData } from '../core/AnalysisContext';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

const FORMAT = 'champions_reg_m_b_doubles';

/**
 * Simula a entrada que `withCompetitiveSet` recebe na prática: `nature` já
 * definida por um passo upstream (ex.: `generateBasicKit`, que decide a
 * partir dos stats base, sem olhar o moveset) e um `moves` final que pode
 * ter sido escolhido por um caminho totalmente independente (ex.:
 * `CompetitiveKitGenerator`). É exatamente esse descompasso que produzia
 * `SET_COHERENCE_FAILURE` — a investigação 088 confirmou que `chooseNature`
 * simplesmente ecoava a `nature` upstream sem checar o moveset final.
 */
function buildInput(overrides: Partial<PokemonData> & { name: string; moves: string[] }): PokemonData {
  return {
    types: ['Normal'],
    item: undefined,
    ability: 'Pressure',
    role: undefined,
    variants: [{ formatId: FORMAT, baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 }, types: ['Normal'], abilities: { 0: 'Pressure' } }],
    ...overrides,
  } as PokemonData;
}

export async function testCompetitiveKitCoherence() {
  console.log('[Equinox Test] Testando coerência do kit competitivo gerado...');

  // Caso 1 — físico
  {
    const input = buildInput({
      name: 'PhysicalMon',
      nature: 'Timid', // incoerente de propósito: upstream decidiu por stats, sem olhar o moveset
      moves: ['Zen Headbutt', 'Rock Slide', 'High Horsepower', 'Protect'],
    });
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    assert(set.nature !== 'Timid', 'Caso 1: nature incoerente (Timid) não pode sobreviver a um moveset 100% físico.');
    assert(set.evs.atk >= set.evs.spa, 'Caso 1: EV de Atk deve ser >= SpA para perfil físico.');
    const coherence = evaluateSetCoherence(set);
    assert(coherence.valid, `Caso 1: setCoherence deveria passar. issues=${JSON.stringify(coherence.criticalIssues)}`);
    console.log(`✅ Caso 1 (físico) PASS — nature corrigida para ${set.nature}`);
  }

  // Caso 2 — especial
  {
    const input = buildInput({
      name: 'SpecialMon',
      nature: 'Adamant', // incoerente: reduz SpA, mas o moveset é todo especial
      moves: ['Psychic', 'Shadow Ball', 'Dazzling Gleam', 'Protect'],
    });
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    assert(set.nature !== 'Adamant', 'Caso 2: nature incoerente (Adamant) não pode sobreviver a um moveset 100% especial.');
    assert(set.evs.spa >= set.evs.atk, 'Caso 2: EV de SpA deve ser >= Atk para perfil especial.');
    const coherence = evaluateSetCoherence(set);
    assert(coherence.valid, `Caso 2: setCoherence deveria passar. issues=${JSON.stringify(coherence.criticalIssues)}`);
    console.log(`✅ Caso 2 (especial) PASS — nature corrigida para ${set.nature}`);
  }

  // Caso 3 — misto (ofensivo em ambos os lados: nenhuma natureza reduz o
  // único stat relevante, porque não há um único stat relevante)
  {
    const input = buildInput({
      name: 'MixedMon',
      nature: 'Hardy',
      moves: ['Earthquake', 'Ice Beam', 'Protect', 'Substitute'],
    });
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    const coherence = evaluateSetCoherence(set);
    assert(coherence.valid, `Caso 3: setCoherence deveria passar para perfil misto. issues=${JSON.stringify(coherence.criticalIssues)}`);
    console.log(`✅ Caso 3 (misto) PASS — nature=${set.nature}`);
  }

  // Caso 4 — suporte (majoritariamente status; sem golpe de dano)
  {
    const input = buildInput({
      name: 'SupportMon',
      role: 'support',
      nature: 'Bold',
      moves: ['Tailwind', 'Helping Hand', 'Protect', 'Encore'],
    });
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    const coherence = evaluateSetCoherence(set);
    assert(coherence.valid, `Caso 4: setCoherence deveria passar para perfil de suporte. issues=${JSON.stringify(coherence.criticalIssues)}`);
    console.log(`✅ Caso 4 (suporte) PASS — nature=${set.nature}`);
  }

  // Caso 5 — Trick Room (perfil ofensivo físico, mas natureza reduz Speed,
  // não Attack — isso é coerente e não deve ser "corrigido")
  {
    const input = buildInput({
      name: 'TrickRoomMon',
      role: 'trick room sweeper',
      nature: 'Brave', // +Atk, -Spe: reduz Speed, não o stat ofensivo relevante
      moves: ['Trick Room', 'Earthquake', 'Rock Slide', 'Protect'],
    });
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    assert(set.nature === 'Brave', `Caso 5: Brave (reduz Speed, não Attack) deveria ser preservada, foi ${set.nature}.`);
    const coherence = evaluateSetCoherence(set);
    assert(coherence.valid, `Caso 5: setCoherence deveria passar. issues=${JSON.stringify(coherence.criticalIssues)}`);
    console.log('✅ Caso 5 (Trick Room) PASS — natureza redutora de Speed preservada');
  }

  // Caso 6 — reprodução exata do Unown real (087-F): stats base empatados
  // (atk===spa===100) fazem `generateBasicKit` escolher Timid, e o moveset
  // final resolvido pelo `CompetitiveKitGenerator`/format solver é físico.
  {
    const input = buildInput({
      name: 'Unown',
      types: ['Psychic'],
      nature: 'Timid',
      moves: ['Zen Headbutt', 'Rock Slide', 'High Horsepower', 'Protect'],
      variants: [{ formatId: FORMAT, baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['Psychic'], abilities: { 0: 'Levitate' } }],
    } as any);
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    const coherence = evaluateSetCoherence(set);
    assert(coherence.valid, `Caso 6 (Unown): setCoherence deveria passar. nature=${set.nature} issues=${JSON.stringify(coherence.criticalIssues)}`);
    console.log(`✅ Caso 6 (reprodução Unown) PASS — nature corrigida para ${set.nature}`);
  }

  // Caso 7 — reprodução exata do Magikarp real (087-F). Sem exceção nominal
  // por espécie: mesma função, mesma lógica do Caso 6.
  {
    const input = buildInput({
      name: 'Magikarp',
      types: ['Water'],
      nature: 'Timid',
      moves: ['Liquidation', 'Rock Slide', 'High Horsepower', 'Protect'],
      variants: [{ formatId: FORMAT, baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 }, types: ['Water'], abilities: { 0: 'Swift Swim' } }],
    } as any);
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    const coherence = evaluateSetCoherence(set);
    assert(coherence.valid, `Caso 7 (Magikarp): setCoherence deveria passar. nature=${set.nature} issues=${JSON.stringify(coherence.criticalIssues)}`);
    console.log(`✅ Caso 7 (reprodução Magikarp) PASS — nature corrigida para ${set.nature}`);
  }

  // Caso 8 — natureza já coerente deve ser preservada intacta (nenhuma troca
  // deve acontecer quando não há contradição).
  {
    const input = buildInput({
      name: 'AlreadyCoherentMon',
      nature: 'Jolly',
      moves: ['Zen Headbutt', 'Rock Slide', 'High Horsepower', 'Protect'],
    });
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    assert(set.nature === 'Jolly', `Caso 8: Jolly (já coerente com moveset físico) não deveria ser trocada, foi ${set.nature}.`);
    console.log('✅ Caso 8 (natureza já coerente preservada) PASS');
  }

  // Caso 9 — troca preserva a intenção estratégica original: o stat
  // potencializado (boost) deve continuar o mesmo; só o lado reduzido muda.
  {
    const input = buildInput({
      name: 'BoostPreservationMon',
      nature: 'Timid', // +Speed, -Attack
      moves: ['Zen Headbutt', 'Rock Slide', 'High Horsepower', 'Protect'],
    });
    const set = resolveCompetitivePokemonSet(input, FORMAT);
    assert(set.nature === 'Jolly', `Caso 9: Timid+moveset físico deveria virar Jolly, foi ${set.nature}.`);

    const NATURE_BOOST: Record<string, string> = { Timid: 'Speed', Jolly: 'Speed' };
    const NATURE_REDUCE: Record<string, string> = { Timid: 'Attack', Jolly: 'Special Attack' };
    assert(NATURE_BOOST['Timid'] === NATURE_BOOST[set.nature], 'Caso 9: o stat potencializado (Speed) deve ser preservado na troca.');
    assert(NATURE_REDUCE[set.nature] === 'Special Attack', 'Caso 9: o stat reduzido deve migrar de Attack para Special Attack, não permanecer em Attack.');
    console.log('✅ Caso 9 (troca preserva o boost original) PASS');
  }

  console.log('✅ CompetitiveKitCoherence testado com sucesso!');
}

if (require.main === module) {
  testCompetitiveKitCoherence().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
