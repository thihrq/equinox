import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { assertCandidateEvidenceFlags, getCandidateEvidenceFlags } from '../config/championsCandidateEvidenceFlags';
import { selectCandidateEvidenceTargets, CandidateTargetSource } from '../services/competitive-data/expert/evidence-generation/CandidateEvidenceTargetSelector';
import { CandidateEvidencePackage } from '../services/competitive-data/expert/evidence-generation/CandidateEvidenceTypes';
import { buildTargetSetRecord, TargetSetRecord } from '../services/competitive-data/expert/evidence-generation/TargetSetCatalog';
import { calculateDamage } from '../services/competitive-data/expert/engines/DamageCalculationEngine';
import { DamageCalculationResult } from '../services/competitive-data/expert/engines/DamageCalculationTypes';
import { calculateSpeedTier } from '../services/competitive-data/expert/engines/SpeedTierEngine';
import { SpeedTierResult } from '../services/competitive-data/expert/engines/SpeedTierTypes';
import { benchmarkCandidate } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkEngine';
import { CompetitiveBenchmarkResult } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkTypes';

declare const process: { env: Record<string, string | undefined>; argv: string[]; exitCode?: number };

const CurationRoot = path.resolve('artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1');
const MechanicsRoot = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles');
const TargetCatalogFile = path.resolve('artifacts/competitive-finalization/targets/target-set-evidence-catalog.json');
const OutputRoot = path.resolve('artifacts/competitive-expert/champions-candidate-evidence-champions-candidate-evidence-v1');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

function writeAtomic(file: string, value: unknown): string {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.env.EQUINOX_EVIDENCE_RUN_ID ?? Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temp, file);
    return file;
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* preserve original write error */ }
    const fallback = `${file}.${Date.now()}.json`;
    fs.writeFileSync(fallback, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    return fallback;
  }
}

interface Draft { pokemonId: string; setId: string; status: 'draft'; sourceType: 'generated'; humanReviewed: false; automaticPromotionAllowed: false; itemId: string; abilityId: string; natureId: string; moveIds: [string, string, string, string]; evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }; ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }; provenance: { candidateDigest: string; packageDigest: string; sourceSnapshotDigest: string }; targetArchetypes: string[]; declaredRoles: string[]; }
interface Scenario extends CandidateTargetSource { assumptions: string[]; limitations: string[]; evidenceLevel: string; }
interface FullTeam { setId: string; structureId: string; teamIds: string[]; legal: boolean; findings?: unknown[]; }
interface Species { pokemonId: string; speciesId: string; types: string[]; baseStats: Record<string, number>; abilities: string[]; }
interface Move { moveId: string; type: string; category: 'physical' | 'special' | 'fixed' | 'status'; power?: number; }
interface Nature { natureId: string; increasedStat: string | null; decreasedStat: string | null; }
interface Evaluation { candidate: Draft; set: TargetSetRecord; targets: ReturnType<typeof selectCandidateEvidenceTargets>; damage: { applicable: boolean; complete: boolean; offensiveBenchmarks: unknown[]; defensiveBenchmarks: unknown[]; unsupportedMechanics: string[]; evidenceDigest: string }; speed: { applicable: boolean; complete: boolean; benchmarks: unknown[]; unsupportedMechanics: string[]; evidenceDigest: string }; engineEvidenceIds: string[]; benchmark?: CompetitiveBenchmarkResult; }

function toDamageStats(stats: TargetSetRecord['calculatedStats']): { hp: number; attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number } { return stats; }

function runDamage(candidate: Draft, candidateSet: TargetSetRecord, target: TargetSetRecord, speciesById: Map<string, Species>, movesById: Map<string, Move>): { results: DamageCalculationResult[]; unsupported: string[] } {
  const candidateSpecies = speciesById.get(candidate.pokemonId);
  const targetSpecies = speciesById.get(target.pokemonId);
  if (!candidateSpecies || !targetSpecies) return { results: [], unsupported: ['species-data-missing'] };
  const results: DamageCalculationResult[] = [];
  const unsupported: string[] = [];
  for (const moveId of candidate.moveIds) {
    const move = movesById.get(moveId);
    if (!move) { unsupported.push(`move:${moveId}:missing`); continue; }
    if (!['physical', 'special'].includes(move.category) || !Number.isFinite(move.power) || (move.power ?? 0) <= 0) continue;
    const result = calculateDamage({ attackerPokemonId: candidateSet.pokemonId, defenderPokemonId: target.pokemonId, moveId, formatId: 'champions-reg-mb-doubles', level: 50, isSpreadMove: true, targetsHit: 2, attackerTypes: candidateSpecies.types, defenderTypes: targetSpecies.types, attackerStats: toDamageStats(candidateSet.calculatedStats), defenderStats: toDamageStats(target.calculatedStats), move: { type: move.type, category: move.category, basePower: move.power } });
    results.push(result);
    unsupported.push(...result.unsupportedMechanics);
  }
  for (const moveId of target.moveIds) {
    const move = movesById.get(moveId);
    if (!move) { unsupported.push(`move:${moveId}:missing`); continue; }
    if (!['physical', 'special'].includes(move.category) || !Number.isFinite(move.power) || (move.power ?? 0) <= 0) continue;
    const result = calculateDamage({ attackerPokemonId: target.pokemonId, defenderPokemonId: candidateSet.pokemonId, moveId, formatId: 'champions-reg-mb-doubles', level: 50, isSpreadMove: true, targetsHit: 2, attackerTypes: targetSpecies.types, defenderTypes: candidateSpecies.types, attackerStats: toDamageStats(target.calculatedStats), defenderStats: toDamageStats(candidateSet.calculatedStats), move: { type: move.type, category: move.category, basePower: move.power } });
    results.push(result);
    unsupported.push(...result.unsupportedMechanics);
  }
  return { results, unsupported: [...new Set(unsupported)] };
}

function runSpeed(candidate: Draft, candidateSet: TargetSetRecord, targets: TargetSetRecord[], speciesById: Map<string, Species>): { results: SpeedTierResult[]; unsupported: string[] } {
  const species = speciesById.get(candidate.pokemonId);
  if (!species) return { results: [], unsupported: ['species-data-missing'] };
  const comparisons = targets.map(target => ({ pokemonId: target.pokemonId, speed: target.calculatedStats.speed }));
  const speedAbilities = new Set(['swift swim', 'chlorophyll', 'sand rush', 'slush rush']);
  const speedAbility = speedAbilities.has(candidateSet.abilityId.toLowerCase()) ? candidateSet.abilityId : undefined;
  const result = calculateSpeedTier({ pokemonId: candidateSet.pokemonId, baseSpeed: species.baseStats.spe, level: 50, speedEv: candidateSet.evs.speed, speedIv: candidateSet.ivs.speed, natureId: candidateSet.natureId, statStage: 0, abilityId: speedAbility, itemId: candidateSet.itemId, tailwind: false, trickRoom: false, comparisons });
  return { results: [result], unsupported: result.unsupportedMechanics };
}

function buildCandidateSet(draft: Draft, speciesById: Map<string, Species>, naturesById: Map<string, Nature>, moves: Move[], abilities: Set<string>, items: Set<string>): TargetSetRecord {
  const species = speciesById.get(draft.pokemonId);
  const nature = naturesById.get(draft.natureId);
  if (!species || !nature) throw new Error(`CANDIDATE_MECHANIC_DATA_MISSING:${draft.setId}`);
  const learnsets = read<{ learnsets: Array<{ pokemonId: string; legalMoveIds: string[] }> }>(path.join(MechanicsRoot, 'learnsets.json')).learnsets;
  const learnset = learnsets.find(item => item.pokemonId === draft.pokemonId);
  if (!learnset) throw new Error(`CANDIDATE_LEARNSET_MISSING:${draft.setId}`);
  return buildTargetSetRecord({ draft, species, nature, legalMoves: new Set(learnset.legalMoveIds), legalAbilities: new Set(species.abilities.filter(ability => abilities.has(ability))), legalItems: items, sourceReferences: [`candidate:${draft.provenance.candidateDigest}`] });
}

function dimensions(evaluation: Evaluation, fullTeamComplete: boolean): { damagePressure: number; speedTier: number; roleFit: number; archetypeFit: number; fullTeamFit: number } {
  const damage = evaluation.damage.offensiveBenchmarks as DamageCalculationResult[];
  const speed = evaluation.speed.benchmarks as SpeedTierResult[];
  return { damagePressure: Math.min(100, damage.reduce((score, item) => score + Math.min(100, item.maxPercent ?? 0), 0) / Math.max(1, damage.length)), speedTier: speed[0]?.fasterThan.length ? 100 : speed[0]?.speedTies.length ? 50 : 0, roleFit: evaluation.candidate.declaredRoles.length > 0 ? 100 : 0, archetypeFit: evaluation.candidate.targetArchetypes.length > 0 ? 100 : 0, fullTeamFit: fullTeamComplete ? 100 : 0 };
}

function main(): void {
  if (process.argv.includes('--check-only')) {
    const flags = getCandidateEvidenceFlags(process.env);
    if (flags.networkReads) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_NETWORK_MUST_BE_DISABLED');
    if (flags.databaseWrites) throw new Error('CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
  } else assertCandidateEvidenceFlags(process.env);
  const drafts = read<Draft[]>(path.join(CurationRoot, 'drafts.json'));
  const scenarios = read<Scenario[]>(path.join(CurationRoot, 'matchups.json'));
  const fullTeams = read<FullTeam[]>(path.join(CurationRoot, 'full-team.json'));
  const targetCatalog = read<{ records: TargetSetRecord[] }>(TargetCatalogFile);
  if (drafts.length !== 20 || scenarios.length !== 120 || fullTeams.length !== 100 || targetCatalog.records.length !== 6) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_SOURCE_INVALID');
  if (targetCatalog.records.some(record => Object.values(record.calculatedStats).some(value => !Number.isFinite(value)))) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_TARGET_STATS_INVALID');
  if (process.argv.includes('--check-only')) { console.log(JSON.stringify({ valid: true, candidateCount: drafts.length, scenarioCount: scenarios.length, fullTeamCount: fullTeams.length, targetSetCount: targetCatalog.records.length, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2)); return; }
  const species = read<{ species: Species[] }>(path.join(MechanicsRoot, 'species.json')).species;
  const moves = read<{ moves: Move[] }>(path.join(MechanicsRoot, 'moves.json')).moves;
  const natures = read<{ natures: Nature[] }>(path.join(MechanicsRoot, 'natures.json')).natures;
  const abilities = new Set(read<{ abilities: Array<{ abilityId: string; globallyAvailableInRegulation?: boolean }> }>(path.join(MechanicsRoot, 'abilities.json')).abilities.filter(item => item.globallyAvailableInRegulation).map(item => item.abilityId));
  const items = new Set(read<{ items: Array<{ itemId: string; legal?: boolean }> }>(path.join(MechanicsRoot, 'items.json')).items.filter(item => item.legal).map(item => item.itemId));
  const speciesById = new Map(species.map(item => [item.pokemonId, item]));
  const movesById = new Map(moves.map(item => [item.moveId, item]));
  const naturesById = new Map(natures.map(item => [item.natureId, item]));
  const targetDigests = Object.fromEntries(targetCatalog.records.map(record => [record.pokemonId, record.targetSetDigest]));
  const evidenceRunId = process.env.EQUINOX_EVIDENCE_RUN_ID ?? 'champions-candidate-evidence-v1';
  const evaluations: Evaluation[] = drafts.map(draft => {
    const set = buildCandidateSet(draft, speciesById, naturesById, moves, abilities, items);
    const targets = selectCandidateEvidenceTargets({ setId: draft.setId, pokemonId: draft.pokemonId, candidateDigest: draft.provenance.candidateDigest }, scenarios, evidenceRunId, targetDigests);
    const targetRecords = targets.map(target => targetCatalog.records.find(record => record.pokemonId === target.pokemonId)).filter((record): record is TargetSetRecord => Boolean(record));
    const damageRuns = targetRecords.map(target => runDamage(draft, set, target, speciesById, movesById));
    const damageResults = damageRuns.flatMap(run => run.results);
    const damageUnsupported = damageRuns.flatMap(run => run.unsupported);
    const speedResults = runSpeed(draft, set, targetRecords, speciesById);
    const damage = { applicable: damageResults.length > 0, complete: damageResults.length > 0 && damageUnsupported.length === 0, offensiveBenchmarks: damageResults, defensiveBenchmarks: damageResults.filter(result => result.componentId.includes('damage-engine')), unsupportedMechanics: [...new Set(damageUnsupported)], evidenceDigest: digest(damageResults) };
    const speed = { applicable: speedResults.results.length > 0, complete: speedResults.results.length > 0 && speedResults.unsupported.length === 0, benchmarks: speedResults.results, unsupportedMechanics: [...new Set(speedResults.unsupported)], evidenceDigest: digest(speedResults.results) };
    return { candidate: draft, set, targets, damage, speed, engineEvidenceIds: [...damageResults, ...speedResults.results].flatMap(result => result.evidence.map(item => item.evidenceId)) };
  });
  const packages: CandidateEvidencePackage[] = evaluations.map(evaluation => {
    const candidateScenarios = scenarios.filter(item => item.setId === evaluation.candidate.setId);
    const candidateTeams = fullTeams.filter(item => item.setId === evaluation.candidate.setId);
    const alternatives = evaluations.filter(item => item.candidate.pokemonId === evaluation.candidate.pokemonId && item.candidate.setId !== evaluation.candidate.setId);
    const fullTeamComplete = candidateTeams.length === 5 && candidateTeams.every(item => item.legal);
    const benchmark = benchmarkCandidate({ candidateId: evaluation.candidate.setId, alternativeCandidateIds: alternatives.map(item => item.candidate.setId), comparisonLimit: 2, candidate: { candidateId: evaluation.candidate.setId, legal: true, evidenceIds: evaluation.engineEvidenceIds, dimensions: dimensions(evaluation, fullTeamComplete) }, alternativeCandidates: alternatives.map(item => ({ candidateId: item.candidate.setId, legal: true, evidenceIds: item.engineEvidenceIds, dimensions: dimensions(item, fullTeams.filter(team => team.setId === item.candidate.setId).every(team => team.legal)) })), maxAlternativesPerCandidate: 2, maxMoveVariations: 4, maxItemVariations: 2, maxNatureVariations: 2 });
    const missing = [!evaluation.damage.complete ? 'damage-evidence' : '', !evaluation.speed.complete ? 'speed-evidence' : '', !benchmark.comparisons.length ? 'benchmark-evidence' : ''].filter(Boolean);
    const complete = evaluation.damage.complete && evaluation.speed.complete && benchmark.comparisons.length > 0 && fullTeamComplete;
    const base = { evidencePackageId: `${evidenceRunId}:${evaluation.candidate.setId}`, evidenceRunId, candidateId: evaluation.candidate.setId, candidateDigest: evaluation.candidate.provenance.candidateDigest, packageDigest: evaluation.candidate.provenance.packageDigest, mechanicsDigest: evaluation.candidate.provenance.packageDigest, rosterDigest: evaluation.candidate.provenance.sourceSnapshotDigest, targets: evaluation.targets, damageEvidence: evaluation.damage, speedEvidence: evaluation.speed, scenarioEvidence: { scenarios: candidateScenarios, complete: candidateScenarios.length === 6, evidenceDigest: digest(candidateScenarios) }, benchmarkEvidence: { comparisons: [benchmark], complete: benchmark.comparisons.length > 0, evidenceDigest: digest(benchmark) }, fullTeamEvidence: { structures: candidateTeams, complete: fullTeamComplete, evidenceDigest: digest(candidateTeams) }, metaDependency: { level: 'meta-helpful' as const, decisionArea: 'alternative comparison', rationale: 'No usage or tournament source is used; local benchmark evidence is explicit.', evidenceReferences: [] }, battleTestDependency: { level: 'required' as const, decisionArea: 'adverse interactions', rationale: 'No live battle evidence is claimed.', limitations: ['No ladder or tournament result is asserted.'] }, unsupportedMechanics: [...new Set([...evaluation.damage.unsupportedMechanics, ...evaluation.speed.unsupportedMechanics, ...benchmark.unsupportedMechanics])], evidenceCompleteness: { status: complete ? 'complete' as const : 'incomplete' as const, score: complete ? 100 : 70, missingEvidence: missing, blockingReasonCodes: missing.map(item => `CANDIDATE_EVIDENCE_${item.toUpperCase().replace(/-/g, '_')}_INCOMPLETE`), roleAware: true }, generatedAt: new Date().toISOString() };
    return { ...base, evidenceDigest: digest(base) };
  });
  const manifest = { evidenceRunId, sourceCurationRunId: 'champions-mb-sentinel-champions-mb-sentinel-v1', targetSetCatalogDigest: digest(targetCatalog), candidateCount: packages.length, damageEvidenceCount: packages.filter(item => item.damageEvidence.complete).length, speedEvidenceCount: packages.filter(item => item.speedEvidence.complete).length, scenarioEvidenceCount: packages.filter(item => item.scenarioEvidence.complete).length, benchmarkEvidenceCount: packages.filter(item => item.benchmarkEvidence.complete).length, fullTeamEvidenceCount: packages.filter(item => item.fullTeamEvidence.complete).length, completeCount: packages.filter(item => item.evidenceCompleteness.status === 'complete').length, completeWithNoncriticalGapsCount: 0, incompleteCount: packages.filter(item => item.evidenceCompleteness.status === 'incomplete').length, blockedCount: 0, expertValidatedCount: 0, expertReviewRequiredCount: packages.length, rejectedCount: 0, mongoReads: 0, mongoWrites: 0, productionWrites: 0, candidatesRegenerated: 0, draftsPromoted: 0, artifactWriteFallbacks: 0 };
  const written = writeAtomic(path.join(OutputRoot, 'candidate-evidence-packages.json'), packages);
  writeAtomic(path.join(OutputRoot, 'run-manifest.json'), { ...manifest, index: written, artifactsDigest: digest({ packages, manifest }) });
  console.log(JSON.stringify({ ...manifest, output: written }, null, 2));
  if (manifest.incompleteCount > 0) process.exitCode = 1;
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
