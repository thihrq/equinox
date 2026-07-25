import crypto from 'crypto';

export interface TargetSetStats { hp: number; attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number; }
export interface TargetSetRecord { targetSetId: string; pokemonId: string; speciesId: string; level: number; itemId: string; abilityId: string; natureId: string; evs: Record<string, number>; ivs: Record<string, number>; moveIds: [string, string, string, string]; calculatedStats: TargetSetStats; roles: string[]; archetypes: string[]; evidenceStatus: 'mechanically-verified' | 'expert-derived'; sourceType: 'sentinel-candidate'; sourceReferences: string[]; evidenceConfidence: 'verified' | 'modeled'; notMetaVerified: true; legalityValidated: true; coherenceValidated: true; calculatedStatsValidated: true; assumptions: string[]; limitations: string[]; targetSetDigest: string; }
export interface TargetSetDraft { setId: string; pokemonId: string; itemId: string; abilityId: string; natureId: string; moveIds: [string, string, string, string]; evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }; ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }; declaredRoles: string[]; targetArchetypes: string[]; }
export interface TargetSpecies { speciesId: string; pokemonId: string; baseStats: Record<string, number>; abilities: string[]; }
export interface TargetNature { natureId: string; increasedStat: string | null; decreasedStat: string | null; }

const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const natureMultiplier = (nature: { increasedStat: string | null; decreasedStat: string | null }, stat: string): number => nature.increasedStat === stat ? 1.1 : nature.decreasedStat === stat ? 0.9 : 1;

export function calculateTargetStats(base: Record<string, number>, evs: Record<string, number>, ivs: Record<string, number>, nature: { increasedStat: string | null; decreasedStat: string | null }, level = 50): TargetSetStats {
  const statKeys: Readonly<Record<keyof Omit<TargetSetStats, 'hp'>, string>> = {
    attack: 'atk',
    defense: 'def',
    specialAttack: 'spa',
    specialDefense: 'spd',
    speed: 'spe',
  };
  const value = (stat: keyof Omit<TargetSetStats, 'hp'>): number => {
    const sourceKey = statKeys[stat];
    const baseValue = base[sourceKey];
    if (!Number.isFinite(baseValue)) throw new Error(`TARGET_SET_BASE_STAT_MISSING:${sourceKey}`);
    return Math.floor((Math.floor((2 * baseValue + ivs[stat] + Math.floor(evs[stat] / 4)) * level / 100) + 5) * natureMultiplier(nature, stat));
  };
  const baseHp = base.hp;
  if (!Number.isFinite(baseHp)) throw new Error('TARGET_SET_BASE_STAT_MISSING:hp');
  return { hp: Math.floor((2 * baseHp + ivs.hp + Math.floor(evs.hp / 4)) * level / 100) + level + 10, attack: value('attack'), defense: value('defense'), specialAttack: value('specialAttack'), specialDefense: value('specialDefense'), speed: value('speed') };
}

export function buildTargetSetRecord(input: { draft: TargetSetDraft; species: TargetSpecies; nature: TargetNature; legalMoves: Set<string>; legalAbilities: Set<string>; legalItems: Set<string>; sourceReferences: string[] }): TargetSetRecord {
  const { draft, species, nature, legalMoves, legalAbilities, legalItems, sourceReferences } = input;
  const evs = { hp: draft.evs.hp, attack: draft.evs.atk, defense: draft.evs.def, specialAttack: draft.evs.spa, specialDefense: draft.evs.spd, speed: draft.evs.spe };
  const ivs = { hp: draft.ivs.hp, attack: draft.ivs.atk, defense: draft.ivs.def, specialAttack: draft.ivs.spa, specialDefense: draft.ivs.spd, speed: draft.ivs.spe };
  if (draft.moveIds.length !== 4 || new Set(draft.moveIds).size !== 4 || draft.moveIds.some((move: string) => !legalMoves.has(move))) throw new Error(`TARGET_SET_MOVE_INVALID:${draft.setId}`);
  if (!legalAbilities.has(draft.abilityId) || !legalItems.has(draft.itemId)) throw new Error(`TARGET_SET_MECHANIC_INVALID:${draft.setId}`);
  if (Object.values(evs).some(value => value < 0 || value > 252) || Object.values(evs).reduce((a, b) => a + b, 0) > 510 || Object.values(ivs).some(value => value < 0 || value > 31)) throw new Error(`TARGET_SET_STATS_INVALID:${draft.setId}`);
  const calculatedStats = calculateTargetStats(species.baseStats, evs, ivs, nature);
  const base = { targetSetId: `target:${draft.setId}`, pokemonId: draft.pokemonId, speciesId: species.speciesId, level: 50, itemId: draft.itemId, abilityId: draft.abilityId, natureId: draft.natureId, evs, ivs, moveIds: draft.moveIds, calculatedStats, roles: draft.declaredRoles, archetypes: draft.targetArchetypes, evidenceStatus: 'mechanically-verified' as const, sourceType: 'sentinel-candidate' as const, sourceReferences, evidenceConfidence: 'verified' as const, notMetaVerified: true as const, legalityValidated: true as const, coherenceValidated: true as const, calculatedStatsValidated: true as const, assumptions: ['set is reused from an existing local sentinel candidate', 'stats use the shared level 50 Pokemon stat formula'], limitations: ['not a usage or tournament set', 'does not prove current metagame strength'] };
  return { ...base, targetSetDigest: digest(base) };
}
