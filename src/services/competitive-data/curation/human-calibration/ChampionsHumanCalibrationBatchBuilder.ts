import fs from 'fs';
import path from 'path';
import { digest } from '../CompetitiveCurationCore';
import { loadChampionsCompetitivePackage } from '../../../../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { CurationSetDraft, FullTeamEvaluation, MatchupScenario } from '../CompetitiveCurationTypes';
import { ChampionsHumanCalibrationBatch, ChampionsHumanCalibrationReviewItem, HumanCalibrationRunManifest } from './ChampionsHumanCalibrationTypes';
import { HUMAN_CALIBRATION_ANONYMIZATION_VERSION, HUMAN_CALIBRATION_POLICY_VERSION, HUMAN_CALIBRATION_METRIC_VERSION, HUMAN_REVIEW_COUNT, HUMAN_REVIEW_SEED } from './ChampionsHumanCalibrationPolicy';

const sourceRoot = (runId: string): string => path.resolve('artifacts/competitive-curation', runId);
const curationRoot = (runId: string): string => path.resolve('artifacts/champions-curation/mb', runId);
function readJson<T>(filePath: string): T { return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T; }
function hashOrder(seed: string, candidate: CurationSetDraft): string { return digest(`${seed}:${candidate.setId}`).slice(-24); }
function blindOrder(drafts: CurationSetDraft[], seed: string): CurationSetDraft[] {
  const remaining = [...drafts].sort((a, b) => hashOrder(seed, a).localeCompare(hashOrder(seed, b)));
  const ordered: CurationSetDraft[] = [];
  while (remaining.length > 0) {
    const previousPokemon = ordered.length > 0 ? ordered[ordered.length - 1].pokemonId : undefined;
    const index = remaining.findIndex(candidate => candidate.pokemonId !== previousPokemon);
    ordered.push(remaining.splice(index < 0 ? 0 : index, 1)[0]);
  }
  return ordered;
}
function validateSource(runId: string): { drafts: CurationSetDraft[]; scenarios: MatchupScenario[]; teams: FullTeamEvaluation[]; selection: { selectedPokemonIds: string[]; packageDigest: string }; sourceAuditRunId: string } {
  const root = curationRoot(runId);
  if (!fs.existsSync(path.join(root, 'drafts.json'))) throw new Error('CHAMPIONS_SENTINEL_ARTIFACTS_MISSING');
  const drafts = readJson<CurationSetDraft[]>(path.join(root, 'drafts.json'));
  const scenarios = readJson<MatchupScenario[]>(path.join(root, 'matchups.json'));
  const teams = readJson<FullTeamEvaluation[]>(path.join(root, 'full-team.json'));
  const selection = readJson<{ selectedPokemonIds: string[]; packageDigest: string }>(path.join(root, 'selection.json'));
  if (drafts.length !== 20 || selection.selectedPokemonIds.length !== 10 || scenarios.length !== 120 || teams.length !== 100) throw new Error('CHAMPIONS_SENTINEL_ARTIFACTS_INVALID');
  if (new Set(drafts.map(draft => draft.provenance.candidateDigest)).size !== 20) throw new Error('CHAMPIONS_SENTINEL_ARTIFACTS_INVALID');
  if (!drafts.every(draft => draft.sourceType === 'generated' && draft.status === 'draft' && draft.humanReviewed === false && draft.automaticPromotionAllowed === false && draft.provenance.packageDigest === selection.packageDigest)) throw new Error('CHAMPIONS_SENTINEL_ARTIFACTS_INVALID');
  const sourceAuditRunId = fs.existsSync(sourceRoot(runId)) ? runId : 'champions-mb-adversarial-champions-mb-adversarial-v1';
  return { drafts, scenarios, teams, selection, sourceAuditRunId };
}
function buildItem(draft: CurationSetDraft, index: number, drafts: CurationSetDraft[], scenarios: MatchupScenario[], teams: FullTeamEvaluation[]): ChampionsHumanCalibrationReviewItem {
  const packageData = loadChampionsCompetitivePackage();
  const roster = packageData.roster.find(entry => entry.pokemonId === draft.pokemonId);
  const species = packageData.species.find(entry => entry.pokemonId === draft.pokemonId);
  const learnset = packageData.learnsets.find(entry => entry.pokemonId === draft.pokemonId);
  const evValues = Object.values(draft.evs);
  const ivValues = Object.values(draft.ivs);
  return {
    reviewItemId: `human-review-item-${String(index + 1).padStart(3, '0')}`,
    candidateId: draft.setId,
    candidateDigest: draft.provenance.candidateDigest,
    pokemonId: draft.pokemonId,
    speciesId: roster?.speciesId ?? draft.pokemonId,
    formId: roster?.formId,
    displayName: roster?.displayName ?? draft.pokemonId,
    set: { itemId: draft.itemId, abilityId: draft.abilityId, natureId: draft.natureId, evs: draft.evs, ivs: draft.ivs, moveIds: draft.moveIds },
    declaredRoles: draft.declaredRoles,
    targetArchetypes: draft.targetArchetypes,
    mechanicalEvidence: { pokemonEligible: Boolean(roster?.legal), formResolved: Boolean(species), abilityLegal: Boolean(learnset?.legalAbilityIds.includes(draft.abilityId)), itemExists: packageData.items.some(item => item.itemId === draft.itemId), movesInLearnset: draft.moveIds.every(move => Boolean(learnset?.legalMoveIds.includes(move))), natureValid: ['adamant', 'bold', 'brave', 'calm', 'careful', 'docile', 'gentle', 'hardy', 'hasty', 'impish', 'jolly', 'lax', 'lonely', 'mild', 'modest', 'naive', 'naughty', 'quiet', 'quirky', 'rash', 'relaxed', 'sassy', 'serious', 'timid'].includes(draft.natureId), evsValid: evValues.every(value => value >= 0 && value <= 252) && evValues.reduce((sum, value) => sum + value, 0) <= 510, ivsValid: ivValues.every(value => value >= 0 && value <= 31) },
    fullTeamContext: teams.filter(team => team.setId === draft.setId).map(team => ({ structureId: team.structureId, identity: team.identity, basePokemonIds: team.basePokemonIds, recommendedPokemonIds: team.recommendedPokemonIds, teamPokemonIds: team.teamIds })),
    matchupContext: scenarios.filter(scenario => scenario.setId === draft.setId).map(scenario => ({ scenarioId: scenario.scenarioId, resultCategory: scenario.result, opposingPokemonIds: scenario.opposingPokemonIds, partnerPokemonIds: scenario.partnerPokemonIds, assumptions: scenario.assumptions, limitations: scenario.limitations, evidenceLevel: scenario.evidenceLevel })),
    knownLimitations: ['No damage calculation is asserted.', 'No ladder or tournament meta claim is asserted.', 'Human review must assess the full-team context and matchup assumptions.'],
    hiddenDuringBlindReview: { agentVerdict: true, aggregateScores: true, candidatePairPosition: true, finalConsolidationRationale: true },
  };
}
export function buildCalibrationBatch(curationRunId: string, auditRunId: string, seed = HUMAN_REVIEW_SEED): { batch: ChampionsHumanCalibrationBatch; manifest: HumanCalibrationRunManifest; internalMapping: object[] } {
  const source = validateSource(curationRunId);
  const ordered = blindOrder(source.drafts, seed);
  const batchId = `champions-mb-human-calibration-${seed}`;
  const batch: ChampionsHumanCalibrationBatch = { calibrationBatchId: batchId, sourceCurationRunId: curationRunId, sourceAuditRunId: auditRunId, regulationId: 'M-B', packageDigest: source.selection.packageDigest, rosterDigest: digest(loadChampionsCompetitivePackage().roster), mechanicsDigest: digest(loadChampionsCompetitivePackage().moves), reviewPolicyVersion: HUMAN_CALIBRATION_POLICY_VERSION, anonymizationVersion: HUMAN_CALIBRATION_ANONYMIZATION_VERSION, candidateCount: HUMAN_REVIEW_COUNT, reviewOrderSeed: seed, reviewItems: ordered.map((draft, index) => buildItem(draft, index, source.drafts, source.scenarios, source.teams)), createdAt: new Date().toISOString(), mongoReads: 0, mongoWrites: 0, productionWrites: 0 };
  const manifest: HumanCalibrationRunManifest = { calibrationBatchId: batchId, sourceCurationRunId: curationRunId, sourceAuditRunId: auditRunId, regulationId: 'M-B', packageDigest: batch.packageDigest, rosterDigest: batch.rosterDigest, mechanicsDigest: batch.mechanicsDigest, reviewPolicyVersion: HUMAN_CALIBRATION_POLICY_VERSION, calibrationMetricVersion: HUMAN_CALIBRATION_METRIC_VERSION, anonymizationVersion: HUMAN_CALIBRATION_ANONYMIZATION_VERSION, reviewMode: 'single-reviewer', candidateCount: HUMAN_REVIEW_COUNT, expectedReviewCount: HUMAN_REVIEW_COUNT, completedReviewCount: 0, state: 'awaiting-human-review', createdAt: batch.createdAt, mongoReads: 0, mongoWrites: 0, productionWrites: 0, artifactsDigest: digest(batch.reviewItems) };
  const internalMapping = ordered.map((draft, index) => ({ reviewItemId: `human-review-item-${String(index + 1).padStart(3, '0')}`, candidateId: draft.setId, candidateDigest: draft.provenance.candidateDigest, originalOrder: source.drafts.findIndex(item => item.setId === draft.setId) + 1 }));
  return { batch, manifest, internalMapping };
}
export function calibrationRoot(batchId: string): string { return path.resolve('artifacts/competitive-curation', batchId, 'human-calibration'); }
export function writeCalibrationArtifact(batchId: string, name: string, value: unknown): void { const root = calibrationRoot(batchId); fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
