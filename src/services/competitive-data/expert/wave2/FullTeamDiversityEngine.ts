// Wave 2 -- full-team partner diversity. Resolves FULL_TEAM_PARTNER_BASE_NOT_DIVERSE (Wave 1's
// transferred finding: all 100 sentinel full-team structures shared one fixed base-3-partner
// trio) by building, per candidate, MULTIPLE 6-Pokemon structures across genuinely different
// "shell" contexts (offensive/defensive/speed-control/Trick Room/Tailwind/weather/terrain/
// support-heavy/low-synergy-stress/neutral), each with a real, legality-checked partner selection
// (Item Clause, Species Clause, Mega limit) -- never the same partner set for every candidate.
import crypto from 'crypto';
import { ChampionsCompetitivePackage, ChampionsSpeciesRecord } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { buildSpeciesMoveContext, classifyStrata, PokemonStrata } from './PokemonProfileClassifier';

/** Deterministic 0-1 tiebreak derived from (candidate, partner, structureIndex) -- so two
 * different candidates never collapse onto the same ranking for shells where every partner scores
 * identically (e.g. 'neutral'), while remaining fully reproducible (no Math.random). */
function deterministicTiebreak(candidatePokemonId: string, partnerId: string, structureIndex: number): number {
  const hash = crypto.createHash('sha256').update(`${candidatePokemonId}:${partnerId}:${structureIndex}`).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

export type FullTeamShell = 'offensive' | 'defensive' | 'speed-control' | 'trick-room' | 'tailwind' | 'weather' | 'terrain' | 'support-heavy' | 'low-synergy-stress' | 'neutral';
export const ALL_SHELLS: readonly FullTeamShell[] = ['offensive', 'defensive', 'speed-control', 'trick-room', 'tailwind', 'weather', 'terrain', 'support-heavy', 'low-synergy-stress', 'neutral'];

export interface TeamMember { pokemonId: string; itemId: string; isMega: boolean; }
export interface FullTeamStructure {
  structureId: string; setId: string; pokemonId: string; shell: FullTeamShell;
  teamIds: string[]; members: TeamMember[];
  legal: boolean; findings: string[];
}
export interface FullTeamDiversityInput { pkg: ChampionsCompetitivePackage; eligiblePokemonIds: string[]; speedPercentiles: { p25: number; p75: number }; }

function shellTagMatch(shell: FullTeamShell, strata: PokemonStrata): number {
  switch (shell) {
    case 'offensive': return (strata.physicalAttacker ? 1 : 0) + (strata.specialAttacker ? 1 : 0);
    case 'defensive': return (strata.wallPhysical ? 1 : 0) + (strata.wallSpecial ? 1 : 0);
    case 'speed-control': return (strata.priorityCapable ? 1 : 0) + (strata.pivotCapable ? 1 : 0);
    case 'trick-room': return (strata.trickRoomCapable ? 2 : 0) + (strata.verySlowSpeed ? 1 : 0);
    case 'tailwind': return (strata.tailwindCapable ? 2 : 0) + (strata.fastSpeed ? 1 : 0);
    case 'weather': return strata.weatherSetter ? 2 : 0;
    case 'terrain': return strata.terrainSetter ? 2 : 0;
    case 'support-heavy': return (strata.redirectionCapable ? 1 : 0) + (strata.fakeOutCapable ? 1 : 0) + (strata.pivotCapable ? 1 : 0);
    case 'low-synergy-stress': return 0; // deliberately unranked by fit -- selected by lowest overlap below.
    case 'neutral': return 0;
  }
}

// Wave 2 peer review (WAVE2-PR-01): legalItemIds is empty for all 203 species in this data pack
// (confirmed directly against learnsets.json), so falling back to the full items catalog
// (568 entries, including mega stones miscategorized under category:'other' -- e.g. 'abomasite'
// is NOT tagged category:'mega-stone' in the source data, so a category filter alone cannot
// reliably exclude them) collapsed every team's item slots onto the same few alphabetically-first
// catalog entries regardless of the member's real species. A curated, generic, real-item pool
// (all confirmed to exist in items.json) is used instead when no species-specific restriction
// exists, cycled deterministically per team slot so members get varied, plausible items rather
// than every structure converging on the same handful of IDs.
const GENERIC_COMPETITIVE_ITEM_POOL: readonly string[] = [
  'leftovers', 'sitrusberry', 'focussash', 'choiceband', 'choicespecs', 'choicescarf', 'lifeorb',
  'assaultvest', 'lightclay', 'heavydutyboots', 'rockyhelmet', 'safetygoggles', 'mentalherb',
  'covertcloak', 'eviolite', 'weaknesspolicy', 'expertbelt', 'blacksludge',
];

function chooseItemAvoidingCollision(legalItemIds: string[], allItems: ChampionsCompetitivePackage['items'], used: Set<string>, rotationSeed: string): string | null {
  const restrictedPool = legalItemIds.filter(id => allItems.some(i => i.itemId === id && i.legal));
  const pool = restrictedPool.length > 0 ? restrictedPool : GENERIC_COMPETITIVE_ITEM_POOL.filter(id => allItems.some(i => i.itemId === id && i.legal));
  const sorted = [...pool].sort();
  // Rotate the starting point deterministically by the member's own identity so different team
  // members (and different candidates reusing this same generic pool) don't all walk the pool in
  // the same alphabetical order and converge on identical item assignments.
  const offset = sorted.length > 0 ? Math.floor(deterministicTiebreak(rotationSeed, 'item-rotation', 0) * sorted.length) : 0;
  const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];
  const free = rotated.find(id => !used.has(id));
  return free ?? rotated[0] ?? null;
}

/** Builds one 6-Pokemon structure (candidate + 5 partners) for a given shell, deterministically. */
export function buildFullTeamStructure(candidatePokemonId: string, setId: string, shell: FullTeamShell, input: FullTeamDiversityInput, structureIndex: number): FullTeamStructure {
  const { pkg, eligiblePokemonIds, speedPercentiles } = input;
  const speciesById = new Map(pkg.species.map(s => [s.pokemonId, s]));
  const pool = eligiblePokemonIds.filter(id => id !== candidatePokemonId && speciesById.has(id));
  const scored = pool.map(id => {
    const species = speciesById.get(id)!;
    const ctx = buildSpeciesMoveContext(species, pkg);
    const strata = classifyStrata(species, ctx, speedPercentiles);
    return { id, species, ctx, score: shell === 'low-synergy-stress' ? -shellTagMatch('offensive', strata) - shellTagMatch('defensive', strata) - shellTagMatch('support-heavy', strata) : shellTagMatch(shell, strata) };
  });
  const ranked = scored
    .map(item => ({ ...item, tiebreak: deterministicTiebreak(candidatePokemonId, item.id, structureIndex) }))
    .sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak || a.id.localeCompare(b.id));
  const partners = ranked.slice(0, 5);

  const candidateSpecies = speciesById.get(candidatePokemonId)!;
  const candidateItems = pkg.learnsets.find(l => l.pokemonId === candidatePokemonId)?.legalItemIds ?? [];
  const usedItems = new Set<string>();
  const candidateItem = chooseItemAvoidingCollision(candidateItems, pkg.items, usedItems, `${candidatePokemonId}:${structureIndex}`);
  if (candidateItem) usedItems.add(candidateItem);

  const members: TeamMember[] = [{ pokemonId: candidatePokemonId, itemId: candidateItem ?? 'none', isMega: Boolean((candidateSpecies as { isMega?: boolean }).isMega) }];
  for (const partner of partners) {
    const partnerItems = pkg.learnsets.find(l => l.pokemonId === partner.id)?.legalItemIds ?? [];
    const itemId = chooseItemAvoidingCollision(partnerItems, pkg.items, usedItems, `${candidatePokemonId}:${partner.id}:${structureIndex}`);
    if (itemId) usedItems.add(itemId);
    members.push({ pokemonId: partner.id, itemId: itemId ?? 'none', isMega: Boolean((partner.species as { isMega?: boolean }).isMega) });
  }

  const findings: string[] = [];
  if (members.length !== 6) findings.push('FULL_TEAM_SIZE_INVALID');
  const distinctPokemon = new Set(members.map(m => m.pokemonId));
  if (distinctPokemon.size !== members.length) findings.push('SPECIES_CLAUSE_VIOLATED');
  const itemCounts = new Map<string, number>();
  for (const m of members) if (m.itemId !== 'none') itemCounts.set(m.itemId, (itemCounts.get(m.itemId) ?? 0) + 1);
  if ([...itemCounts.values()].some(count => count > 1)) findings.push('ITEM_CLAUSE_VIOLATED');
  const megaCount = members.filter(m => m.isMega).length;
  if (megaCount > 1) findings.push('MEGA_LIMIT_VIOLATED');

  return { structureId: `${setId}-fullteam-${shell}-${structureIndex}`, setId, pokemonId: candidatePokemonId, shell, teamIds: members.map(m => m.pokemonId), members, legal: findings.length === 0, findings };
}
