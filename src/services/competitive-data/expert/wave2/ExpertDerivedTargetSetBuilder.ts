// Wave 2 -- sibling to TargetSetCatalog.buildTargetSetRecord (unmodified, still used for
// sentinel-derived targets). This builder is for NEW, non-sentinel-derived targets built to fill
// the profile gaps documented in targets/coverage-gaps.json. It reuses calculateTargetStats
// (exported, unmodified) but applies its own evidenceStatus/sourceType/evidenceConfidence and,
// critically, a hard eligibility guard: a provisional or blocked pokemonId can never produce a
// record (mission section 13 gate: provisionalUsed=0, blockedUsed=0).
import crypto from 'crypto';
import { calculateTargetStats, TargetSetStats } from '../evidence-generation/TargetSetCatalog';

export type TargetEligibilityStatus = 'eligible' | 'provisional' | 'blocked';

export interface ExpertDerivedTargetDraft {
  setId: string;
  pokemonId: string;
  itemId: string;
  abilityId: string;
  natureId: string;
  moveIds: [string, string, string, string];
  evs: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  ivs: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  declaredRoles: string[];
  targetArchetypes: string[];
  profileId: string;
}

export interface ExpertDerivedTargetSetRecord {
  targetSetId: string; pokemonId: string; speciesId: string; level: number;
  itemId: string; abilityId: string; natureId: string;
  evs: TargetSetStats; ivs: TargetSetStats; moveIds: [string, string, string, string];
  calculatedStats: TargetSetStats;
  roles: string[]; archetypes: string[]; intendedUses: string[]; benchmarkClasses: string[]; speedClasses: string[]; defensiveClasses: string[];
  evidenceStatus: 'expert-derived';
  evidenceConfidence: 'modeled';
  sourceType: 'roster-derived';
  sourceReferences: string[];
  assumptions: string[]; limitations: string[];
  legalityValidated: true; coherenceValidated: boolean; calculatedStatsValidated: true;
  notMetaVerified: true;
  schemaVersion: string; policyVersion: string; targetSetDigest: string;
  profileId: string;
}

const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

export const EXPERT_DERIVED_TARGET_SCHEMA_VERSION = 'champions-target-set-evidence-v1';
export const EXPERT_DERIVED_TARGET_POLICY_VERSION = 'wave2-target-catalog-expansion-v1';

export function buildExpertDerivedTargetSetRecord(input: {
  draft: ExpertDerivedTargetDraft;
  species: { speciesId: string; pokemonId: string; baseStats: Record<string, number> };
  nature: { increasedStat: string | null; decreasedStat: string | null };
  eligibilityStatus: TargetEligibilityStatus;
  legalMoves: Set<string>; legalAbilities: Set<string>; legalItems: Set<string>;
  coherent: boolean;
  intendedUses: string[]; benchmarkClasses: string[]; speedClasses: string[]; defensiveClasses: string[];
  sourceReferences: string[];
}): ExpertDerivedTargetSetRecord {
  const { draft, species, nature, eligibilityStatus, legalMoves, legalAbilities, legalItems, coherent, intendedUses, benchmarkClasses, speedClasses, defensiveClasses, sourceReferences } = input;
  if (eligibilityStatus !== 'eligible') throw new Error(`TARGET_SET_PROVISIONAL_OR_BLOCKED_REJECTED:${draft.setId}:${eligibilityStatus}`);
  if (draft.moveIds.length !== 4 || new Set(draft.moveIds).size !== 4 || draft.moveIds.some(move => !legalMoves.has(move))) throw new Error(`TARGET_SET_MOVE_INVALID:${draft.setId}`);
  if (!legalAbilities.has(draft.abilityId) || !legalItems.has(draft.itemId)) throw new Error(`TARGET_SET_MECHANIC_INVALID:${draft.setId}`);
  const evs = { hp: draft.evs.hp, attack: draft.evs.atk, defense: draft.evs.def, specialAttack: draft.evs.spa, specialDefense: draft.evs.spd, speed: draft.evs.spe };
  const ivs = { hp: draft.ivs.hp, attack: draft.ivs.atk, defense: draft.ivs.def, specialAttack: draft.ivs.spa, specialDefense: draft.ivs.spd, speed: draft.ivs.spe };
  if (Object.values(evs).some(value => value < 0 || value > 252) || Object.values(evs).reduce((a, b) => a + b, 0) > 510 || Object.values(ivs).some(value => value < 0 || value > 31)) throw new Error(`TARGET_SET_STATS_INVALID:${draft.setId}`);
  const calculatedStats = calculateTargetStats(species.baseStats, evs, ivs, nature);
  const base = {
    targetSetId: `target:${draft.setId}`, pokemonId: draft.pokemonId, speciesId: species.speciesId, level: 50,
    itemId: draft.itemId, abilityId: draft.abilityId, natureId: draft.natureId, evs, ivs, moveIds: draft.moveIds,
    calculatedStats, roles: draft.declaredRoles, archetypes: draft.targetArchetypes,
    intendedUses, benchmarkClasses, speedClasses, defensiveClasses,
    evidenceStatus: 'expert-derived' as const, evidenceConfidence: 'modeled' as const, sourceType: 'roster-derived' as const, sourceReferences,
    assumptions: ['set is newly constructed to fill a documented target-catalog profile gap, not sourced from an existing matchup scenario', 'stats use the shared level 50 Pokemon stat formula'],
    limitations: ['not a usage or tournament set', 'does not prove current metagame strength', 'expert-derived confidence, not mechanically-verified from existing evidence'],
    legalityValidated: true as const, coherenceValidated: coherent, calculatedStatsValidated: true as const, notMetaVerified: true as const,
    schemaVersion: EXPERT_DERIVED_TARGET_SCHEMA_VERSION, policyVersion: EXPERT_DERIVED_TARGET_POLICY_VERSION,
    profileId: draft.profileId,
  };
  return { ...base, targetSetDigest: digest(base) };
}
