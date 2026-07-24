export const POKEMON_SPECIES_TYPES: Record<string, string[]> = {
  charizard: ['Fire', 'Flying'],
  jolteon: ['Electric'],
  lapras: ['Water', 'Ice'],
  garchomp: ['Dragon', 'Ground'],
  'rotom-wash': ['Electric', 'Water'],
  scizor: ['Bug', 'Steel'],
  venusaur: ['Grass', 'Poison'],
  arcanine: ['Fire'],
  gyarados: ['Water', 'Flying'],
  incineroar: ['Fire', 'Dark'],
  rillaboom: ['Grass'],
  fluttermane: ['Ghost', 'Fairy'],
};

export const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
];

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

export function getPokemonTypesByName(name: string): string[] {
  if (!name) return ['Normal'];
  const norm = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  return POKEMON_SPECIES_TYPES[norm] || ['Normal'];
}

export function getTypeMultiplier(attackerType: string, defenderTypes: string[]): number {
  if (!defenderTypes?.length) return 1;
  const attackerChart = TYPE_CHART[attackerType] || {};
  let mult = 1;
  defenderTypes.forEach(defType => {
    mult *= (attackerChart[defType] ?? 1);
  });
  return mult;
}

export function calculateTeamWeaknesses(teamTypes: string[][]) {
  const result: Record<string, { type: string; weakCount: number; doubleWeakCount: number; highestMultiplier: number }> = {};

  ALL_TYPES.forEach(attackerType => {
    let weakCount = 0;
    let doubleWeakCount = 0;
    let highestMultiplier = 0;

    teamTypes.forEach(memberTypes => {
      const mult = getTypeMultiplier(attackerType, memberTypes);
      if (mult > highestMultiplier) highestMultiplier = mult;
      if (mult >= 4) {
        doubleWeakCount++;
        weakCount++;
      } else if (mult >= 2) {
        weakCount++;
      }
    });

    result[attackerType] = { type: attackerType, weakCount, doubleWeakCount, highestMultiplier };
  });

  return result;
}
