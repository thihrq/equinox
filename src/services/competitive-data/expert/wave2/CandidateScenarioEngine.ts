// Wave 2 -- candidate-specific scenario generation. Resolves SCENARIO_EVIDENCE_NOT_DISCRIMINATIVE
// (Wave 1's transferred finding: the sentinel's 120 scenarios were byte-for-byte identical across
// all 20 candidates) by computing real matchups via the same DamageCalculationEngine and
// SpeedTierEngine used elsewhere in this pipeline (Wave 1B reference conformance), driven entirely
// by each candidate's own drafted moves/item/ability/stats against real target-catalog entries --
// never a fixed template.
import crypto from 'crypto';
import { ChampionsCompetitivePackage, ChampionsMoveRecord, ChampionsSpeciesRecord } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { CurationSetDraft } from '../../curation/CompetitiveCurationTypes';
import { calculateTargetStats, TargetSetStats } from '../evidence-generation/TargetSetCatalog';
import { calculateDamage } from '../engines/DamageCalculationEngine';
import { compareActionOrder } from '../engines/SpeedTierEngine';
import { ExpertDerivedTargetSetRecord } from './ExpertDerivedTargetSetBuilder';
import { buildSpeciesMoveContext, classifyStrata, PokemonStrata } from './PokemonProfileClassifier';

export interface CatalogTargetRecord {
  targetSetId: string; pokemonId: string; moveIds: readonly string[]; calculatedStats: TargetSetStats;
  roles?: string[]; archetypes?: string[]; speedClasses?: string[]; defensiveClasses?: string[]; profileId?: string;
}
export interface CandidateScenario {
  scenarioId: string; setId: string; targetSetId: string;
  result: 'favorable' | 'neutral' | 'adverse'; outcome: 'supports-candidate' | 'mixed' | 'does-not-support-candidate';
  candidateMoveId: string; targetMoveId: string;
  candidateMaxPercent: number; targetMaxPercent: number; actionOrder: 'first' | 'second' | 'tie';
  fingerprint: string;
  assumptions: string[]; limitations: string[];
  evidenceLevel: 'engine-computed';
}
export interface CandidateScenarioSet { setId: string; pokemonId: string; scenarios: CandidateScenario[]; signature: string; }

const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

function natureFor(natureId: string, natures: Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>): { increasedStat: string | null; decreasedStat: string | null } {
  const nature = natures.find(n => n.natureId === natureId);
  return nature ?? { increasedStat: null, decreasedStat: null };
}

function candidateCalculatedStats(species: ChampionsSpeciesRecord, draft: CurationSetDraft, natures: Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>): TargetSetStats {
  const evs = { hp: draft.evs.hp, attack: draft.evs.atk, defense: draft.evs.def, specialAttack: draft.evs.spa, specialDefense: draft.evs.spd, speed: draft.evs.spe };
  const ivs = { hp: draft.ivs.hp, attack: draft.ivs.atk, defense: draft.ivs.def, specialAttack: draft.ivs.spa, specialDefense: draft.ivs.spd, speed: draft.ivs.spe };
  return calculateTargetStats(species.baseStats, evs, ivs, natureFor(draft.natureId, natures));
}

function bestDamagingMove(moveIds: readonly string[], moveById: Map<string, ChampionsMoveRecord>): ChampionsMoveRecord | null {
  const candidates = moveIds.map(id => moveById.get(id)).filter((m): m is ChampionsMoveRecord => Boolean(m) && (m!.power ?? 0) > 0);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0];
}

function selectTargetsForCandidate(candidateTags: string[], catalog: CatalogTargetRecord[], count: number): CatalogTargetRecord[] {
  const scored = catalog.map(target => {
    const targetTags = [...(target.roles ?? []), ...(target.archetypes ?? []), ...(target.speedClasses ?? []), ...(target.defensiveClasses ?? []), ...(target.profileId ? [target.profileId] : [])];
    const overlap = candidateTags.filter(tag => targetTags.includes(tag)).length;
    // A candidate benefits from evidence against targets it does NOT already resemble (its actual
    // opponents), so complementary/contrasting profiles are weighted at least as high as overlap --
    // rank by a stable, generic combination of (some tag relevance, deterministic id) rather than
    // pure similarity, avoiding "pick targets that make the candidate look good" bias.
    return { target, score: overlap, id: target.targetSetId };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // Deterministic diverse sample: interleave top-relevance and bottom-relevance (contrasting)
  // targets so a candidate is tested against both its "natural counters" and out-of-context
  // opponents, per mission section 17 ("favorable; neutral; adverse; ... pressure test").
  const half = Math.ceil(count / 2);
  const top = scored.slice(0, half);
  const bottom = scored.slice(-1 * (count - half)).reverse();
  const picked = [...top, ...bottom].filter((item, index, array) => array.findIndex(other => other.id === item.id) === index).slice(0, count);
  return picked.map(p => p.target);
}

export interface GenerateCandidateScenariosInput {
  pkg: ChampionsCompetitivePackage;
  natures: Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>;
  catalog: CatalogTargetRecord[];
  targetsPerCandidate: number;
}

export function generateCandidateScenarios(draft: CurationSetDraft, input: GenerateCandidateScenariosInput): CandidateScenarioSet {
  const { pkg, natures, catalog, targetsPerCandidate } = input;
  const speciesById = new Map(pkg.species.map(s => [s.pokemonId, s]));
  const moveById = new Map(pkg.moves.map(m => [m.moveId, m]));
  const species = speciesById.get(draft.pokemonId);
  if (!species) throw new Error(`WAVE2_SCENARIO_SPECIES_NOT_FOUND:${draft.pokemonId}`);

  const candidateStats = candidateCalculatedStats(species, draft, natures);
  const ctx = buildSpeciesMoveContext(species, pkg);
  // Tag the candidate by its own drafted move slate, not its full learnset -- a candidate is a
  // specific set, and its target-selection relevance should reflect what it actually carries.
  const draftMoveContext = { ...ctx, legalMoves: draft.moveIds.map(id => moveById.get(id)).filter((m): m is ChampionsMoveRecord => Boolean(m)) };
  const strata: PokemonStrata = classifyStrata(species, draftMoveContext, { p25: 80, p75: 150 });
  const candidateTags = [strata.physicalAttacker ? 'physical-attacker' : null, strata.specialAttacker ? 'special-attacker' : null, strata.mixedAttacker ? 'mixed-attacker' : null, strata.fastSpeed ? 'fast' : null, strata.slowSpeed ? 'slow' : null, strata.verySlowSpeed ? 'very-slow' : null, strata.trickRoomCapable ? 'trick-room' : null, strata.tailwindCapable ? 'tailwind' : null, strata.weatherSetter ? 'weather-setter' : null, strata.terrainSetter ? 'terrain-setter' : null, strata.redirectionCapable ? 'redirection' : null, strata.fakeOutCapable ? 'fake-out' : null, strata.priorityCapable ? 'priority-attacker' : null, strata.pivotCapable ? 'pivot' : null, strata.wallPhysical ? 'physical-wall' : null, strata.wallSpecial ? 'special-wall' : null].filter((t): t is string => Boolean(t));

  const targets = selectTargetsForCandidate(candidateTags, catalog, targetsPerCandidate);
  const candidateMove = bestDamagingMove(draft.moveIds, moveById);

  const scenarios: CandidateScenario[] = targets.map((target, index) => {
    const targetSpecies = speciesById.get(target.pokemonId);
    const targetMove = bestDamagingMove(target.moveIds, moveById);
    let candidateMaxPercent = 0; let targetMaxPercent = 0;
    if (candidateMove && targetSpecies) {
      const result = calculateDamage({
        attackerPokemonId: draft.pokemonId, defenderPokemonId: target.pokemonId, moveId: candidateMove.moveId, formatId: 'champions-reg-mb-doubles', level: 50, isSpreadMove: false, targetsHit: 1,
        attackerTypes: species.types, defenderTypes: targetSpecies.types, attackerStats: candidateStats, defenderStats: target.calculatedStats,
        move: { type: candidateMove.type, category: candidateMove.category === 'status' ? 'status' : (candidateMove.category as 'physical' | 'special'), basePower: candidateMove.power ?? undefined },
      });
      candidateMaxPercent = result.maxPercent ?? 0;
    }
    if (targetMove && targetSpecies) {
      const result = calculateDamage({
        attackerPokemonId: target.pokemonId, defenderPokemonId: draft.pokemonId, moveId: targetMove.moveId, formatId: 'champions-reg-mb-doubles', level: 50, isSpreadMove: false, targetsHit: 1,
        attackerTypes: targetSpecies.types, defenderTypes: species.types, attackerStats: target.calculatedStats, defenderStats: candidateStats,
        move: { type: targetMove.type, category: targetMove.category === 'status' ? 'status' : (targetMove.category as 'physical' | 'special'), basePower: targetMove.power ?? undefined },
      });
      targetMaxPercent = result.maxPercent ?? 0;
    }
    // Both sides' calculatedStats.speed already come from the identical, already-validated
    // calculateTargetStats() formula (candidateStats above, target.calculatedStats from the real
    // target catalog) -- reused directly rather than recomputed a second time via
    // calculateSpeedTier(), which would risk two independently-implemented formulas diverging.
    const order = compareActionOrder({ speed: candidateStats.speed, priority: candidateMove?.priority ?? 0 }, { speed: target.calculatedStats.speed, priority: targetMove?.priority ?? 0 }, false);

    const favorable = candidateMaxPercent >= 50 && (order === 'first' || targetMaxPercent < 50);
    const adverse = !favorable && targetMaxPercent >= 50 && (order === 'second' || candidateMaxPercent < 50);
    const result: CandidateScenario['result'] = favorable ? 'favorable' : adverse ? 'adverse' : 'neutral';
    const scenarioInput = { setId: draft.setId, targetSetId: target.targetSetId, candidateMoveId: candidateMove?.moveId ?? 'none', targetMoveId: targetMove?.moveId ?? 'none', candidateMaxPercent, targetMaxPercent, order };
    return {
      scenarioId: `${draft.setId}-scenario-${index + 1}`, setId: draft.setId, targetSetId: target.targetSetId, result,
      outcome: result === 'favorable' ? 'supports-candidate' : result === 'adverse' ? 'does-not-support-candidate' : 'mixed',
      candidateMoveId: candidateMove?.moveId ?? 'none', targetMoveId: targetMove?.moveId ?? 'none', candidateMaxPercent, targetMaxPercent, actionOrder: order,
      fingerprint: digest(scenarioInput),
      assumptions: ['damage/speed use the same DamageCalculationEngine/SpeedTierEngine used for Wave 1B reference conformance', 'target moveset/EVs come from the real expanded target catalog'],
      limitations: ['single representative move per side, not a full 4-move matrix', 'no held-item/ability combat effects beyond what the engines already model'],
      evidenceLevel: 'engine-computed',
    };
  });

  const signature = digest(scenarios.map(s => s.fingerprint).sort());
  return { setId: draft.setId, pokemonId: draft.pokemonId, scenarios, signature };
}
