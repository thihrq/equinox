import { normalizeChampionsId } from '../../../../equinox/data-normalization/champions/ChampionsAliasNormalizer';

const ALIASES: Readonly<Record<string, string>> = {
  'raichu-alolan-form': 'raichu-alola',
  'ninetales-alolan-form': 'ninetales-alola',
  'arcanine-hisuian-form': 'arcanine-hisui',
  'slowbro-galarian-form': 'slowbro-galar',
  'typhlosion-hisuian-form': 'typhlosion-hisui',
  'slowking-galarian-form': 'slowking-galar',
  'samurott-hisuian-form': 'samurott-hisui',
  'zoroark-hisuian-form': 'zoroark-hisui',
  'stunfisk-galarian-form': 'stunfisk-galar',
  'goodra-hisuian-form': 'goodra-hisui',
  'avalugg-hisuian-form': 'avalugg-hisui',
  'decidueye-hisuian-form': 'decidueye-hisui',
  'tauros-paldean-form-combat-breed': 'tauros-paldea-combat',
  'tauros-paldean-form-blaze-breed': 'tauros-paldea-blaze',
  'tauros-paldean-form-aqua-breed': 'tauros-paldea-aqua',
  'rotom-rotom': 'rotom',
  'rotom-heat-rotom': 'rotom-heat',
  'rotom-wash-rotom': 'rotom-wash',
  'rotom-frost-rotom': 'rotom-frost',
  'rotom-fan-rotom': 'rotom-fan',
  'rotom-mow-rotom': 'rotom-mow',
  'meowstic-male': 'meowstic-m',
  'meowstic-female': 'meowstic-f',
  'gourgeist-medium-variety': 'gourgeist',
  'gourgeist-small-variety': 'gourgeist-small',
  'gourgeist-large-variety': 'gourgeist-large',
  'gourgeist-jumbo-variety': 'gourgeist-super',
  'lycanroc-midday-form': 'lycanroc-midday',
  'lycanroc-midnight-form': 'lycanroc-midnight',
  'lycanroc-dusk-form': 'lycanroc-dusk',
  'basculegion-male': 'basculegion',
  'basculegion-female': 'basculegion-f',
};

const SHOWDOWN_COMPACT_ALIASES: Readonly<Record<string, string>> = {
  arcaninehisui: 'arcanine-hisui',
  avalugghisui: 'avalugg-hisui',
  basculegionf: 'basculegion-f',
  charizardmegax: 'charizard-mega-x',
  charizardmegay: 'charizard-mega-y',
  decidueyehisui: 'decidueye-hisui',
  goodrahisui: 'goodra-hisui',
  gourgeistlarge: 'gourgeist-large',
  gourgeistsmall: 'gourgeist-small',
  gourgeistsuper: 'gourgeist-super',
  kommoo: 'kommo-o',
  lycanrocdusk: 'lycanroc-dusk',
  lycanrocmidday: 'lycanroc-midday',
  lycanrocmidnight: 'lycanroc-midnight',
  mrrime: 'mr-rime',
  meowsticf: 'meowstic-f',
  meowsticm: 'meowstic-m',
  ninetalesalola: 'ninetales-alola',
  raichualola: 'raichu-alola',
  rotomfan: 'rotom-fan',
  rotomfrost: 'rotom-frost',
  rotomheat: 'rotom-heat',
  rotommow: 'rotom-mow',
  rotomwash: 'rotom-wash',
  samurotthisui: 'samurott-hisui',
  slowbrogalar: 'slowbro-galar',
  slowkinggalar: 'slowking-galar',
  stunfiskgalar: 'stunfisk-galar',
  taurospaldeaaqua: 'tauros-paldea-aqua',
  taurospaldeablaze: 'tauros-paldea-blaze',
  taurospaldeacombat: 'tauros-paldea-combat',
  typhlosionhisui: 'typhlosion-hisui',
  zoroarkhisui: 'zoroark-hisui',
};

export function canonicalizeShowdownId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return SHOWDOWN_COMPACT_ALIASES[normalized] ?? normalized;
}

export interface AliasResolution {
  normalizedId: string;
  showdownId?: string;
  ambiguous: boolean;
  candidates: string[];
}

export function normalizeGenerationAlias(value: string): string {
  const normalized = normalizeChampionsId(value);
  return ALIASES[normalized] ?? ALIASES[normalized.replace(/-form$/, '')] ?? normalized.replace(/-form$/, '');
}

export function resolveGenerationAlias(value: string, availableIds: ReadonlySet<string>): AliasResolution {
  const normalizedId = normalizeGenerationAlias(value);
  const exactCandidates = [...availableIds].filter(id => canonicalizeShowdownId(id) === normalizedId);
  if (exactCandidates.length === 1) return { normalizedId, showdownId: exactCandidates[0], ambiguous: false, candidates: exactCandidates };
  const candidates = [...availableIds].filter(id => canonicalizeShowdownId(id).startsWith(`${normalizedId}-`) || normalizedId.startsWith(`${canonicalizeShowdownId(id)}-`)).sort();
  return { normalizedId, showdownId: candidates.length === 1 ? candidates[0] : undefined, ambiguous: candidates.length > 1, candidates };
}
