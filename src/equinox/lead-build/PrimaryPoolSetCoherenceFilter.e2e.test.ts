process.env.EQUINOX_DATA_MODE = 'mongo';

import dotenv from 'dotenv';
dotenv.config();

import { connectIsolatedTestDatabase, IsolatedTestDatabase } from './testing/IsolatedTestDatabase';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { Pokemon } from '../../models/Pokemon';
import { PokemonSet } from '../../models/PokemonSet';

let isolatedDatabase: IsolatedTestDatabase | null = null;

async function disposeIsolatedDatabase(): Promise<void> {
  if (!isolatedDatabase) return;
  await isolatedDatabase.dispose();
  isolatedDatabase = null;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

const FORMAT = 'champions_reg_m_b_doubles';
const INCOHERENT_CANDIDATE_NAME = 'Sandslash-Alola';

function mon(dexNumber: number, name: string, types: string[], baseStats: Record<string, number>, usageScore = 90) {
  return {
    dexNumber,
    name,
    formatId: FORMAT,
    types,
    variants: [{ formatId: FORMAT, baseStats, types, abilities: { 0: 'Pressure' } }],
    isLegendary: false,
    usageScore,
    formatLegality: { [FORMAT]: true },
  };
}

function set(
  pokemonName: string,
  item: string,
  ability: string,
  nature: string,
  evs: Record<string, number>,
  moves: string[],
  role = 'attacker',
) {
  return {
    pokemonName,
    formatId: FORMAT,
    setName: `${pokemonName} test`,
    item,
    ability,
    nature,
    evs,
    moves,
    role,
    synergyTags: [],
    legal: true,
    status: 'active',
    active: true,
    confidence: 80,
  };
}

/**
 * Reproduz, de forma determinística, o achado real de produção (lead
 * Charizard-Mega-Y+Whimsicott, champions_reg_m_b_doubles): um `PokemonSet`
 * armazenado para Sandslash-Alola era internamente incoerente (Adamant
 * reduz SpA mas o set investia 124 EVs em SpA e misturava Blizzard —
 * movimento especial — com golpes físicos). Esse candidato pontuava bem o
 * suficiente para ser selecionado em praticamente toda tentativa do
 * builder, reprovando o time inteiro em SetCoherence de forma sistemática.
 *
 * Diferente dos demais testes E2E desta suíte, este NÃO sobrescreve
 * `primaryCandidateFetcher` — o objetivo é exercitar o caminho real de
 * `fetchAndScoreCandidates`, onde o filtro de coerência foi adicionado.
 */
async function main(): Promise<void> {
  console.log('🧪 Teste E2E: filtro de coerência interna no pool primário de candidatos...');

  isolatedDatabase = await connectIsolatedTestDatabase();

  try {
    await Pokemon.create([
      mon(6, 'Charizard-Mega-Y', ['Fire', 'Flying'], { hp: 78, atk: 104, def: 78, spa: 159, spd: 115, spe: 100 }),
      mon(547, 'Whimsicott', ['Grass', 'Fairy'], { hp: 60, atk: 67, def: 85, spa: 77, spd: 75, spe: 116 }),
      // BST >= 450 (piso do formato) mantendo a mesma incoerência de set do achado real.
      mon(28, INCOHERENT_CANDIDATE_NAME, ['Ice', 'Steel'], { hp: 75, atk: 110, def: 120, spa: 30, spd: 65, spe: 75 }, 99),
      mon(812, 'Rillaboom', ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
      mon(591, 'Amoonguss', ['Grass', 'Poison'], { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 }),
      mon(645, 'Landorus-Therian', ['Ground', 'Flying'], { hp: 89, atk: 145, def: 90, spa: 105, spd: 80, spe: 91 }),
      mon(149, 'Dragonite', ['Dragon', 'Flying'], { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 }),
      mon(445, 'Garchomp', ['Dragon', 'Ground'], { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 }),
      mon(485, 'Heatran', ['Fire', 'Steel'], { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 }),
    ] as any);

    await PokemonSet.create([
      // Incoerente de propósito: Adamant (-SpA) + 124 EVs em SpA + Blizzard
      // (especial) misturado com golpes físicos — reproduz o dado real de
      // produção que sabotava toda tentativa do builder.
      set(INCOHERENT_CANDIDATE_NAME, 'Muscle Band', 'Slush Rush', 'Adamant',
        { hp: 4, atk: 252, def: 0, spa: 124, spd: 0, spe: 128 },
        ['Ice Spinner', 'Iron Head', 'Blizzard', 'Protect']),
      set('Rillaboom', 'Assault Vest', 'Grassy Surge', 'Adamant',
        { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
        ['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']),
      set('Amoonguss', 'Sitrus Berry', 'Regenerator', 'Calm',
        { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
        ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect']),
      set('Landorus-Therian', 'Choice Scarf', 'Intimidate', 'Jolly',
        { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
        ['Earthquake', 'Rock Slide', 'U-turn', 'Protect']),
      set('Dragonite', 'Loaded Dice', 'Multiscale', 'Adamant',
        { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 },
        ['Scale Shot', 'Extreme Speed', 'Low Kick', 'Protect']),
      set('Garchomp', 'Rocky Helmet', 'Rough Skin', 'Jolly',
        { hp: 252, atk: 4, def: 0, spa: 0, spd: 0, spe: 252 },
        ['Dragon Claw', 'Earthquake', 'Rock Slide', 'Protect']),
      set('Heatran', 'Safety Goggles', 'Flash Fire', 'Calm',
        { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 },
        ['Heat Wave', 'Earth Power', 'Protect', 'Taunt']),
    ] as any);

    const service = new LeadStrategyRecommendationService();
    const result: any = await service.execute({
      lead: [{ name: 'Charizard-Mega-Y' }, { name: 'Whimsicott' }],
      format: FORMAT,
      leadMode: 'fixed-lead',
      allowLegendaries: false,
      teamIdentity: 'balanced',
    });

    console.log(`  - Estratégias aceitas: ${result.strategies?.length ?? 0}`);
    assert(
      (result.strategies?.length ?? 0) > 0,
      'Pelo menos uma estratégia deveria ser aceita mesmo com um candidato de set incoerente no pool',
    );

    for (const strategy of result.strategies) {
      const teamNames: string[] = strategy.completions?.[0]?.fullTeam?.map((m: any) => m.name) ?? [];
      assert(
        !teamNames.includes(INCOHERENT_CANDIDATE_NAME),
        `Estratégia ${strategy.strategy.id} aceitou ${INCOHERENT_CANDIDATE_NAME} apesar do set internamente incoerente: ${teamNames.join(', ')}`,
      );
    }

    console.log(`  - ${INCOHERENT_CANDIDATE_NAME} (set incoerente) corretamente excluído de todos os times aceitos (OK)`);
    console.log('\n✅ Teste E2E de filtro de coerência no pool primário passou.');
  } finally {
    await disposeIsolatedDatabase();
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Teste falhou:', error);
    disposeIsolatedDatabase().finally(() => process.exit(1));
  });
