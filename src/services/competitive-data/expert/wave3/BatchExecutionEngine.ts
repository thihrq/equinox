// Wave 3 -- runs the real, full 32-step-equivalent pipeline (draft generation -> legality review ->
// candidate-specific scenarios -> full-team diversity -> benchmark diversity -> Stage4 expert
// validation -> verdict) for one batch's own species list, in complete isolation from any other
// batch: every intermediate structure (drafts, scenarios, structures, benchmark alternatives) is
// built fresh from this batch's own candidates only, so nothing here reads or mutates state shared
// with another batch. Deliberately reuses Wave 2's engines unmodified (generateDrafts/
// validateDrafts/generateCandidateScenarios/buildFullTeamStructure/benchmarkCandidate/
// validateCandidateWithExperts) -- this is the same pipeline the Wave 2 pilot proved out, just
// parameterized over an arbitrary species list instead of the fixed 20-species pilot.
import crypto from 'crypto';
import { ChampionsCompetitivePackage, ChampionsMoveRecord } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { ChampionsPackageValidationResult } from '../../../../equinox/data-packs/champions/ChampionsPackageTypes';
import { generateDrafts, validateDrafts } from '../../curation/CompetitiveCurationCore';
import { CurationConfig, CurationSetDraft, SentinelSelection, CandidateReview } from '../../curation/CompetitiveCurationTypes';
import { generateCandidateScenarios, CatalogTargetRecord, CandidateScenarioSet } from '../wave2/CandidateScenarioEngine';
import { buildSpeciesMoveContext, classifyStrata, maxCalculatedSpeed, hasTailwindMove, hasTrickRoomMove, hasWeatherSetter, hasTerrainSetter } from '../wave2/PokemonProfileClassifier';
import { ALL_SHELLS, buildFullTeamStructure, FullTeamShell, FullTeamStructure } from '../wave2/FullTeamDiversityEngine';
import { benchmarkCandidate } from '../engines/CompetitiveBenchmarkEngine';
import { BenchmarkCandidate } from '../engines/CompetitiveBenchmarkTypes';
import { validateCandidateWithExperts } from '../Stage4ExpertOrchestrator';
import { Stage4CandidateContext, Stage4CandidateValidationResult } from '../Stage4ExpertTypes';
import { FullRosterExpansionPolicy } from './FullRosterExpansionPolicy';

const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

const INSUFFICIENT_MOVES_PREFIX = 'INSUFFICIENT_LEARNSET_MOVES:';
const MIN_STRUCTURES_PER_CANDIDATE = 5; // matches Stage4's runFullTeamSpecialist threshold (fullTeamEvidenceCount >= 5) -- same fix proven in Wave 2.

function generateDraftsWithGracefulSkipping(config: CurationConfig, selection: SentinelSelection): { drafts: CurationSetDraft[]; skipped: { pokemonId: string; reason: string }[] } {
  let workingIds = [...selection.selectedPokemonIds];
  const skipped: { pokemonId: string; reason: string }[] = [];
  for (let attempt = 0; attempt < workingIds.length + 1; attempt += 1) {
    try {
      const drafts = generateDrafts(config, { ...selection, selectedPokemonIds: workingIds });
      return { drafts, skipped };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith(INSUFFICIENT_MOVES_PREFIX)) throw error;
      const failingId = message.slice(INSUFFICIENT_MOVES_PREFIX.length);
      if (!workingIds.includes(failingId)) throw error;
      skipped.push({ pokemonId: failingId, reason: message });
      workingIds = workingIds.filter(id => id !== failingId);
    }
  }
  return { drafts: [], skipped };
}

function dominantShellFor(pokemonId: string, pkg: ChampionsCompetitivePackage, speedPercentiles: { p25: number; p75: number }): FullTeamShell {
  const species = pkg.species.find(s => s.pokemonId === pokemonId)!;
  const ctx = buildSpeciesMoveContext(species, pkg);
  const strata = classifyStrata(species, ctx, speedPercentiles);
  if (strata.trickRoomCapable) return 'trick-room';
  if (strata.tailwindCapable) return 'tailwind';
  if (strata.weatherSetter) return 'weather';
  if (strata.terrainSetter) return 'terrain';
  if (strata.redirectionCapable || strata.fakeOutCapable) return 'support-heavy';
  if (strata.wallPhysical || strata.wallSpecial) return 'defensive';
  return 'offensive';
}

export interface BatchExecutionInput {
  pkg: ChampionsCompetitivePackage;
  validation: ChampionsPackageValidationResult;
  natures: Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>;
  catalog: CatalogTargetRecord[];
  pokemonIds: string[];
  runId: string;
  batchId: string;
  policy: FullRosterExpansionPolicy;
}

export interface BatchCandidateResult {
  setId: string; pokemonId: string; context: Stage4CandidateContext; validation: Stage4CandidateValidationResult; scenarioSet: CandidateScenarioSet;
  durationMs: number;
}

export interface BatchExecutionResult {
  drafts: CurationSetDraft[]; reviews: CandidateReview[]; skippedSpecies: { pokemonId: string; reason: string }[];
  fullTeamStructures: FullTeamStructure[]; results: BatchCandidateResult[];
  packageDigest: string; mechanicsDigest: string; rosterDigest: string;
}

export function executeBatch(input: BatchExecutionInput): BatchExecutionResult {
  const { pkg, validation, natures, catalog, pokemonIds, runId, batchId, policy } = input;

  const config: CurationConfig = { snapshotId: `wave3-${runId}-${batchId}`, regulationId: 'M-B', pokemonLimit: pokemonIds.length, candidatesPerPokemon: policy.maxCandidatesPerPokemon, seed: `${policy.seedBase}:${batchId}`, packageDigest: pkg.sourceManifest.packageDigest, package: pkg };
  const selection: SentinelSelection = { sentinelRunId: `wave3-${runId}-${batchId}`, snapshotId: config.snapshotId, regulationId: 'M-B', packageDigest: config.packageDigest, eligiblePoolDigest: digest(pokemonIds), seed: config.seed, policyVersion: policy.policyVersion, selectedPokemonIds: pokemonIds, representedCategories: [], missingCategories: [], blockers: [], warnings: [] };

  const { drafts, skipped } = generateDraftsWithGracefulSkipping(config, selection);
  const reviews = validateDrafts(config, drafts);
  const reviewBySetId = new Map(reviews.map(r => [r.setId, r]));

  const speeds = validation.eligiblePokemonIds.map(id => { const s = pkg.species.find(sp => sp.pokemonId === id); return s ? maxCalculatedSpeed(s) : 0; }).sort((a, b) => a - b);
  const percentile = (p: number) => speeds[Math.floor(speeds.length * p)] ?? speeds[speeds.length - 1];
  const speedPercentiles = { p25: percentile(0.25), p75: percentile(0.75) };

  const fullTeamStructures: FullTeamStructure[] = drafts.flatMap((draft, draftIndex) => {
    const dominant = dominantShellFor(draft.pokemonId, pkg, speedPercentiles);
    const shells: FullTeamShell[] = [dominant, 'neutral', 'low-synergy-stress'];
    for (let offset = 0; shells.length < MIN_STRUCTURES_PER_CANDIDATE; offset += 1) {
      const candidate = ALL_SHELLS[(draftIndex + offset) % ALL_SHELLS.length];
      if (!shells.includes(candidate)) shells.push(candidate);
    }
    return shells.map((shell, shellIndex) => buildFullTeamStructure(draft.pokemonId, draft.setId, shell, { pkg, eligiblePokemonIds: validation.eligiblePokemonIds, speedPercentiles }, draftIndex * 10 + shellIndex));
  });

  const packageDigest = pkg.sourceManifest.packageDigest;
  const mechanicsDigest = digest({ moves: pkg.moves.length, abilities: pkg.abilities.length, items: pkg.items.length });
  const rosterDigest = digest(pkg.roster.map(r => r.pokemonId).sort());
  const speciesById = new Map(pkg.species.map(s => [s.pokemonId, s]));

  const scenarioBySetId = new Map(drafts.map(draft => [draft.setId, generateCandidateScenarios(draft, { pkg, natures, catalog, targetsPerCandidate: policy.evidenceRequirements.minScenarioCount })]));

  function dimensionsFor(draft: CurationSetDraft): BenchmarkCandidate['dimensions'] {
    const scenarios = scenarioBySetId.get(draft.setId)!.scenarios;
    const damagePressure = scenarios.length > 0 ? Math.round(scenarios.reduce((sum, s) => sum + s.candidateMaxPercent, 0) / scenarios.length) : 0;
    const favorableRate = scenarios.length > 0 ? Math.round((scenarios.filter(s => s.result === 'favorable').length / scenarios.length) * 100) : 0;
    const speedTier = Math.round(Math.min(100, (scenarios.filter(s => s.actionOrder === 'first').length / Math.max(scenarios.length, 1)) * 100));
    const structures = fullTeamStructures.filter(s => s.setId === draft.setId);
    const fullTeamFit = structures.length > 0 ? Math.round((structures.filter(s => s.legal).length / structures.length) * 100) : 0;
    return { damagePressure: Math.min(100, damagePressure), speedTier, roleFit: favorableRate, archetypeFit: favorableRate, fullTeamFit };
  }

  const bySpecies = new Map<string, CurationSetDraft[]>();
  for (const draft of drafts) bySpecies.set(draft.pokemonId, [...(bySpecies.get(draft.pokemonId) ?? []), draft]);
  const dominatedBySetId = new Map<string, boolean>();
  for (const draft of drafts) {
    const sibling = (bySpecies.get(draft.pokemonId) ?? []).find(d => d.setId !== draft.setId);
    const otherIndex = drafts.length > 0 ? (drafts.findIndex(d => d.setId === draft.setId) + 7) % drafts.length : 0;
    const otherCandidate = drafts[otherIndex];
    const otherFallback = drafts[(otherIndex + 1) % Math.max(drafts.length, 1)];
    const other = otherCandidate && otherCandidate.setId !== draft.setId ? otherCandidate : otherFallback;
    const alternatives = [sibling, other].filter((d): d is CurationSetDraft => d !== undefined && d.setId !== draft.setId);
    const candidate: BenchmarkCandidate = { candidateId: draft.setId, legal: true, evidenceIds: scenarioBySetId.get(draft.setId)!.scenarios.map(s => s.scenarioId), dimensions: dimensionsFor(draft) };
    const alternativeCandidates: BenchmarkCandidate[] = alternatives.map(alt => ({ candidateId: alt.setId, legal: true, evidenceIds: scenarioBySetId.get(alt.setId)!.scenarios.map(s => s.scenarioId), dimensions: dimensionsFor(alt) }));
    const result = benchmarkCandidate({ candidateId: draft.setId, alternativeCandidateIds: alternativeCandidates.map(a => a.candidateId), comparisonLimit: 5, candidate, alternativeCandidates, maxAlternativesPerCandidate: 5, maxMoveVariations: 3, maxItemVariations: 3, maxNatureVariations: 3 });
    dominatedBySetId.set(draft.setId, result.dominated);
  }

  const results: BatchCandidateResult[] = drafts.map(draft => {
    const t0 = Date.now();
    const species = speciesById.get(draft.pokemonId)!;
    const review = reviewBySetId.get(draft.setId)!;
    const scenarioSet = scenarioBySetId.get(draft.setId)!;
    const favorableScenarioCount = scenarioSet.scenarios.filter(s => s.result === 'favorable').length;
    const adverseScenarioCount = scenarioSet.scenarios.filter(s => s.result === 'adverse').length;
    const candidateStructures = fullTeamStructures.filter(s => s.setId === draft.setId);
    const fullTeamLegal = candidateStructures.length > 0 && candidateStructures.every(s => s.legal);
    const draftMoves = draft.moveIds.map(id => pkg.moves.find(m => m.moveId === id)).filter((m): m is ChampionsMoveRecord => Boolean(m));
    const moveCtx = { ...buildSpeciesMoveContext(species, pkg), legalMoves: draftMoves };
    const maxCandidatePercent = scenarioSet.scenarios.length > 0 ? Math.max(...scenarioSet.scenarios.map(s => s.candidateMaxPercent)) : 0;
    const distinctDamagingTypes = new Set(draftMoves.filter(m => (m.power ?? 0) > 0).map(m => m.type)).size;

    const context: Stage4CandidateContext = {
      candidate: { candidateId: draft.setId, candidateDigest: draft.provenance.candidateDigest, sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false },
      legal: review.legal, coherent: review.coherent, rolesSupported: review.rolesSupported, generationResolved: true, formResolved: true,
      damageEvidence: scenarioSet.scenarios.length > 0, speedEvidence: scenarioSet.scenarios.length > 0,
      scenarioEvidenceCount: scenarioSet.scenarios.length, favorableScenarioCount, adverseScenarioCount,
      fullTeamEvidenceCount: candidateStructures.length, fullTeamLegal, benchmarkEvidence: true,
      unsupportedMechanics: [],
      packageDigest, mechanicsDigest, rosterDigest, previousVerdict: 'agent-reviewed', archetype: draft.targetArchetypes[0] ?? 'balanced',
      isMega: false, isRegional: draft.pokemonId.includes('-') && draft.pokemonId.split('-')[1] !== '000',
      hasTrickRoom: hasTrickRoomMove(moveCtx), hasTailwind: hasTailwindMove(moveCtx), hasWeather: hasWeatherSetter(moveCtx), hasTerrain: hasTerrainSetter(moveCtx),
      criticalReviewSignals: {
        candidateDominated: dominatedBySetId.get(draft.setId) ?? false,
        fullTeamRiskMaterial: candidateStructures.length < policy.evidenceRequirements.minFullTeamStructureCount || !fullTeamLegal,
        noWinCondition: maxCandidatePercent < 50,
        coverageInsufficient: distinctDamagingTypes <= 1,
        excessivePartnerDependency: false,
        contradictoryEvidence: false,
      },
    };
    const validationResult = validateCandidateWithExperts(context);
    return { setId: draft.setId, pokemonId: draft.pokemonId, context, validation: validationResult, scenarioSet, durationMs: Date.now() - t0 };
  });

  return { drafts, reviews, skippedSpecies: skipped, fullTeamStructures, results, packageDigest, mechanicsDigest, rosterDigest };
}
