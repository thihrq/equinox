export const GENERATION_CATALOG_SCHEMA_VERSION = 'champions-mb-generation-catalog-v1';
export const GENERATION_CATALOG_SOURCE_REVISION = 'equinox-generation-source-catalog-v1';

export interface GenerationRange {
  minimumDex: number;
  maximumDex: number;
  generation: number;
}

export const SPECIES_GENERATION_RANGES: readonly GenerationRange[] = [
  { minimumDex: 1, maximumDex: 151, generation: 1 },
  { minimumDex: 152, maximumDex: 251, generation: 2 },
  { minimumDex: 252, maximumDex: 386, generation: 3 },
  { minimumDex: 387, maximumDex: 493, generation: 4 },
  { minimumDex: 494, maximumDex: 649, generation: 5 },
  { minimumDex: 650, maximumDex: 721, generation: 6 },
  { minimumDex: 722, maximumDex: 809, generation: 7 },
  { minimumDex: 810, maximumDex: 905, generation: 8 },
  { minimumDex: 906, maximumDex: 1025, generation: 9 },
];

export const FORM_GENERATION_OVERRIDES: Readonly<Record<string, number>> = {
  'charizard-mega-x': 6,
  'charizard-mega-y': 6,
  'mawile-mega': 6,
  'metagross-mega': 6,
  'raichu-mega-x': 6,
  'raichu-mega-y': 6,
  'raichu-alola': 7,
  'ninetales-alola': 7,
  'rotom': 4,
  'rotom-heat': 4,
  'rotom-wash': 4,
  'rotom-frost': 4,
  'rotom-fan': 4,
  'rotom-mow': 4,
  'meowstic-m': 6,
  'meowstic-f': 6,
  'gourgeist': 6,
  'gourgeist-small': 6,
  'gourgeist-large': 6,
  'gourgeist-super': 6,
  'lycanroc-midday': 7,
  'lycanroc-midnight': 7,
  'lycanroc-dusk': 7,
  'arcanine-hisui': 8,
  'slowbro-galar': 8,
  'typhlosion-hisui': 8,
  'slowking-galar': 8,
  'samurott-hisui': 8,
  'zoroark-hisui': 8,
  'goodra-hisui': 8,
  'avalugg-hisui': 8,
  'decidueye-hisui': 8,
  'stunfisk-galar': 8,
  'tauros-paldea-combat': 9,
  'tauros-paldea-blaze': 9,
  'tauros-paldea-aqua': 9,
  'basculegion': 9,
  'basculegion-f': 9,
};

export function resolveSpeciesGeneration(nationalDexNumber: number): number | undefined {
  return SPECIES_GENERATION_RANGES.find(({ minimumDex, maximumDex }) => nationalDexNumber >= minimumDex && nationalDexNumber <= maximumDex)?.generation;
}

export function resolveFormGeneration(showdownId: string, speciesGeneration: number): number {
  return FORM_GENERATION_OVERRIDES[showdownId] ?? speciesGeneration;
}
