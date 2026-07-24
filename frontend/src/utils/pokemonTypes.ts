// Matriz de tipos e eficácia competitiva do Pokémon

export const POKEMON_SPECIES_TYPES: Record<string, string[]> = {
  // Gen 1-9 Starters and Popular Competitive Species
  charizard: ['Fire', 'Flying'],
  'charizard-mega-x': ['Fire', 'Dragon'],
  'charizard-mega-y': ['Fire', 'Flying'],
  jolteon: ['Electric'],
  lapras: ['Water', 'Ice'],
  garchomp: ['Dragon', 'Ground'],
  'rotom-wash': ['Electric', 'Water'],
  rotomwash: ['Electric', 'Water'],
  scizor: ['Bug', 'Steel'],
  venusaur: ['Grass', 'Poison'],
  arcanine: ['Fire'],
  'arcanine-hisui': ['Fire', 'Rock'],
  gyarados: ['Water', 'Flying'],
  blastoise: ['Water'],
  pikachu: ['Electric'],
  raichu: ['Electric'],
  'raichu-alola': ['Electric', 'Psychic'],
  clefable: ['Fairy'],
  ninetales: ['Fire'],
  'ninetales-alola': ['Ice', 'Fairy'],
  gengar: ['Ghost', 'Poison'],
  dragonite: ['Dragon', 'Flying'],
  mewtwo: ['Psychic'],
  tyranitar: ['Rock', 'Dark'],
  salamence: ['Dragon', 'Flying'],
  metagross: ['Steel', 'Psychic'],
  kyogre: ['Water'],
  groudon: ['Ground'],
  rayquaza: ['Dragon', 'Flying'],
  lucario: ['Fighting', 'Steel'],
  heatran: ['Fire', 'Steel'],
  torent: ['Water'],
  excadrill: ['Ground', 'Steel'],
  ferrothorn: ['Grass', 'Steel'],
  volcarona: ['Bug', 'Fire'],
  landorus: ['Ground', 'Flying'],
  'landorus-therian': ['Ground', 'Flying'],
  thundurus: ['Electric', 'Flying'],
  greninja: ['Water', 'Dark'],
  aegislash: ['Steel', 'Ghost'],
  sylveon: ['Fairy'],
  incineroar: ['Fire', 'Dark'],
  rillaboom: ['Grass'],
  urshifu: ['Fighting', 'Dark'],
  'urshifu-rapid-strike': ['Fighting', 'Water'],
  dragapult: ['Dragon', 'Ghost'],
  kingambit: ['Dark', 'Steel'],
  fluttermane: ['Ghost', 'Fairy'],
  chiyu: ['Dark', 'Fire'],
  chienpao: ['Dark', 'Ice'],
  ironbundle: ['Ice', 'Water'],
  ironhands: ['Fighting', 'Electric'],
  torkoal: ['Fire'],
  pelipper: ['Water', 'Flying'],
  kingdra: ['Water', 'Dragon'],
  ludicolo: ['Water', 'Grass'],
  swampert: ['Water', 'Ground'],
  'swampert-mega': ['Water', 'Ground'],
  leafeon: ['Grass'],
  glaceon: ['Ice'],
  umbreon: ['Dark'],
  espeon: ['Psychic'],
  vaporeon: ['Water'],
  flareon: ['Fire'],
  zapdos: ['Electric', 'Flying'],
  moltres: ['Fire', 'Flying'],
  articuno: ['Ice', 'Flying'],
  aloom: ['Grass'],
  breloom: ['Grass', 'Fighting'],
  amoonguss: ['Grass', 'Poison'],
  grimmsnarl: ['Dark', 'Fairy'],
  whimsicott: ['Grass', 'Fairy'],
  dondozo: ['Water'],
  tatsugiri: ['Dragon', 'Water'],
  gholdengo: ['Steel', 'Ghost'],
  ogerpon: ['Grass'],
  'ogerpon-wellspring': ['Grass', 'Water'],
  'ogerpon-hearthflame': ['Grass', 'Fire'],
  'ogerpon-cornerstone': ['Grass', 'Rock'],
  archaludon: ['Steel', 'Dragon'],
};

export const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
];

// Tabela de Efetividade (Atacante -> Defensor)
// 2 = Super Efetivo, 0.5 = Resistido, 0 = Imune, 1 = Neutro
const TYPE_CHART: Record<string, Record<string, number>> = {
  Normal:   { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire:     { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water:    { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass:    { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice:      { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison:   { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground:   { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying:   { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug:      { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock:     { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost:    { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon:   { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark:     { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel:    { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy:    { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

/**
 * Busca os tipos reais de uma espécie pelo nome.
 */
export function getPokemonTypesByName(name: string): string[] {
  if (!name) return ['Normal'];
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (POKEMON_SPECIES_TYPES[normalized]) {
    return POKEMON_SPECIES_TYPES[normalized];
  }
  const baseName = normalized.split('-')[0];
  if (POKEMON_SPECIES_TYPES[baseName]) {
    return POKEMON_SPECIES_TYPES[baseName];
  }
  return ['Normal'];
}

/**
 * Calcula o multiplicador de dano de um tipo atacante contra os tipos do defensor.
 */
export function getTypeMultiplier(attackerType: string, defenderTypes: string[]): number {
  if (!defenderTypes?.length) return 1;
  const attackerChart = TYPE_CHART[attackerType] || {};
  let mult = 1;
  defenderTypes.forEach(defType => {
    const factor = attackerChart[defType] ?? 1;
    mult *= factor;
  });
  return mult;
}

export interface TypeWeaknessAnalysis {
  type: string;
  weakCount: number; // Quantos no time tomam 2x ou 4x
  doubleWeakCount: number; // Quantos no time tomam 4x
  resistedCount: number; // Quantos no time tomam 0.5x ou 0.25x
  immuneCount: number; // Quantos no time são imunes (0x)
  highestMultiplier: number;
}

/**
 * Calcula a análise de fraquezas de toda a equipe para os 18 tipos elementais.
 */
export function calculateTeamWeaknesses(teamTypes: string[][]): Record<string, TypeWeaknessAnalysis> {
  const result: Record<string, TypeWeaknessAnalysis> = {};

  ALL_TYPES.forEach(attackerType => {
    let weakCount = 0;
    let doubleWeakCount = 0;
    let resistedCount = 0;
    let immuneCount = 0;
    let highestMultiplier = 0;

    teamTypes.forEach(memberTypes => {
      const mult = getTypeMultiplier(attackerType, memberTypes);
      if (mult > highestMultiplier) highestMultiplier = mult;

      if (mult >= 4) {
        doubleWeakCount++;
        weakCount++;
      } else if (mult >= 2) {
        weakCount++;
      } else if (mult === 0) {
        immuneCount++;
      } else if (mult < 1) {
        resistedCount++;
      }
    });

    result[attackerType] = {
      type: attackerType,
      weakCount,
      doubleWeakCount,
      resistedCount,
      immuneCount,
      highestMultiplier,
    };
  });

  return result;
}
