import { Pokemon } from '../../../models/Pokemon';
import { assertCanonicalPokemonType } from './DeterministicCandidateSources';

/**
 * General-purpose coherent fixture corpus.
 * Not guaranteed to force primary failure or recovery execution.
 * Do not use for phase-sensitive recovery assertions.
 *
 * Achado 088-H: com tipos canônicos corrigidos (088-G1), este pool de 13
 * espécies é suficientemente capaz para que estratégias nativas passem no
 * gate defensivo diretamente pelo primary, sem nunca acionar recovery — o
 * que invalidou as asserções de fase estrita de `recoveryRequired.e2e.test.ts`
 * e `recoveryFailsClosed.e2e.test.ts`, migradas para
 * `DeterministicCandidateSources` (fontes primária/recovery disjuntas e
 * controladas por teste).
 */
const FORMAT = 'champions_reg_m_b_doubles';

interface FixtureOptions {
  readonly usageScore: number;
  readonly dexNumber: number;
  readonly types: string[];
}

function buildPokemonFixture(name: string, options: FixtureOptions) {
  const { usageScore, dexNumber, types } = options;
  types.forEach(assertCanonicalPokemonType);
  return {
    dexNumber,
    name,
    formatId: FORMAT,
    types,
    variants: [
      {
        formatId: FORMAT,
        baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
        types,
        abilities: { 0: 'Pressure' },
      },
    ],
    stats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: { 0: 'Pressure' },
    isLegendary: false,
    usageScore,
    formatLegality: { [FORMAT]: true },
    competitiveSet: {
      setId: `e2e-${name.toLowerCase()}`,
      pokemon: name,
      format: FORMAT,
      item: 'Leftovers',
      ability: 'Pressure',
      nature: 'Modest',
      moves: ['Protect'],
    },
  };
}

/**
 * Espécies usadas como lead pelos três E2E de recovery.
 *
 * Antes, esses testes assumiam que alguém já havia rodado `npm run db:seed` no
 * banco de desenvolvimento compartilhado. Isso os tornava não herméticos: sem o
 * seed prévio o service rejeitava o lead com HTTP 400 e o teste falhava antes
 * de alcançar o comportamento sob teste — indistinguível de uma regressão real.
 */
const LEAD_SPECIES: ReadonlyArray<[string, FixtureOptions]> = [
  ['Unown', { usageScore: 10, dexNumber: 201, types: ['Psychic'] }],
  ['Magikarp', { usageScore: 9, dexNumber: 129, types: ['Water'] }],
  ['Charizard-Mega-Y', { usageScore: 95, dexNumber: 6, types: ['Fire', 'Flying'] }],
  ['Whimsicott', { usageScore: 94, dexNumber: 547, types: ['Grass', 'Fairy'] }],
];

/**
 * Semeia o lead mais um pool de candidatos pequeno.
 *
 * O pool existe para que a busca primária tenha o que examinar e chegue à fase
 * de recovery de forma realista; é deliberadamente insuficiente para formar um
 * time completo, que é a condição sob teste.
 */
export async function seedRecoveryTestFixtures(): Promise<void> {
  const documents = LEAD_SPECIES.map(([name, options]) => buildPokemonFixture(name, options));

  // Espécies reais, não nomes sintéticos: os guards de arquétipo do VGC
  // consultam o Dex pelo nome, e um `PoolMon-N` inexistente é descartado antes
  // de poder compor um time.
  const poolSpecies: ReadonlyArray<[string, number, string[]]> = [
    ['Heatran', 485, ['Fire', 'Steel']],
    ['Rillaboom', 812, ['Grass']],
    ['Incineroar', 727, ['Fire', 'Dark']],
    ['Amoonguss', 591, ['Grass', 'Poison']],
    ['Landorus-Therian', 645, ['Ground', 'Flying']],
    ['Gholdengo', 1000, ['Steel', 'Ghost']],
    ['Dragonite', 149, ['Dragon', 'Flying']],
    ['Garchomp', 445, ['Dragon', 'Ground']],
    ['Pelipper', 279, ['Water', 'Flying']],
    ['Kingambit', 983, ['Dark', 'Steel']],
    ['Tornadus', 641, ['Flying']],
    ['Iron Hands', 992, ['Fighting', 'Electric']],
  ];

  poolSpecies.forEach(([name, dexNumber, types], index) => {
    documents.push(buildPokemonFixture(name, { usageScore: 80 - index, dexNumber, types }));
  });

  await Pokemon.create(documents);
}
