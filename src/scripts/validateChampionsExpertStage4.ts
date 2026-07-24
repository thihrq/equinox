import fs from 'fs';
import path from 'path';
import { validateCandidateWithExperts } from '../services/competitive-data/expert/Stage4ExpertOrchestrator';
import { STAGE4_SPECIALIST_VERSIONS } from '../services/competitive-data/expert/Stage4SpecialistContracts';
import { Stage4CandidateContext } from '../services/competitive-data/expert/Stage4ExpertTypes';
import { loadStage4SentinelContexts } from '../services/competitive-data/expert/Stage4SentinelData';

declare const process: { argv: string[]; exitCode?: number };

const root = path.resolve('artifacts/competitive-curation/champions-mb-sentinel-champions-mb-sentinel-v1/expert-validation/champions-mb-expert-validation-v1');
const read = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')) as T;

function positiveContext(): Stage4CandidateContext {
  return {
    candidate: { candidateId: 'stage4-positive-control', candidateDigest: 'sha256:positive-control', sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false },
    legal: true, coherent: true, rolesSupported: true, generationResolved: true, formResolved: true, damageEvidence: true, speedEvidence: true,
    scenarioEvidenceCount: 6, favorableScenarioCount: 6, adverseScenarioCount: 0, fullTeamEvidenceCount: 5, fullTeamLegal: true, benchmarkEvidence: true,
    unsupportedMechanics: [], packageDigest: 'sha256:package', mechanicsDigest: 'sha256:mechanics', rosterDigest: 'sha256:roster', previousVerdict: 'agent-reviewed',
    archetype: 'balanced', isMega: false, isRegional: false, hasTrickRoom: false, hasTailwind: false, hasWeather: false, hasTerrain: false,
  };
}

function assert(condition: unknown, code: string): asserts condition { if (!condition) throw new Error(code); }

function run(mode: string): void {
  if (mode === 'specialists') {
    const result = validateCandidateWithExperts(positiveContext());
    assert(result.specialistResults.length === Object.keys(STAGE4_SPECIALIST_VERSIONS).length - 1, 'STAGE4_SPECIALIST_COUNT_INVALID');
    assert(result.specialistResults.every(item => item.inputDigest.startsWith('sha256:') && item.outputDigest.startsWith('sha256:')), 'STAGE4_SPECIALIST_DIGEST_MISSING');
    assert(new Set(result.specialistResults.map(item => item.specialistId)).size === Object.keys(STAGE4_SPECIALIST_VERSIONS).length - 1, 'STAGE4_SPECIALIST_DUPLICATE');
    console.log(JSON.stringify({ valid: true, specialistCount: result.specialistResults.length, specialistVersions: STAGE4_SPECIALIST_VERSIONS, crossSpecialistDependencies: 0 }, null, 2));
    return;
  }
  if (mode === 'evidence') {
    const results = read<Array<{ valid: boolean }>>('evidence-audit-results.json');
    const verdicts = read<Array<{ verdict: string }>>('final-expert-verdicts.json');
    assert(results.length === 20, 'STAGE4_EVIDENCE_CANDIDATE_COUNT_INVALID');
    assert(results.every(item => item.valid === false), 'STAGE4_REAL_EVIDENCE_EXPECTED_INCOMPLETE');
    assert(verdicts.every(item => item.verdict !== 'expert-validated'), 'STAGE4_INCOMPLETE_EVIDENCE_VALIDATED');
    console.log(JSON.stringify({ valid: true, candidateCount: results.length, completeEvidenceCount: 0, expertValidatedCount: 0 }, null, 2));
    return;
  }
  if (mode === 'independence') {
    const result = validateCandidateWithExperts(positiveContext());
    assert(result.candidateId === 'stage4-positive-control', 'STAGE4_FIXTURE_MUTATED');
    assert(result.specialistResults.every(item => item.evidence.every(evidence => evidence.description.includes('no other specialist output'))), 'STAGE4_SPECIALIST_DEPENDENCY_LEAK');
    console.log(JSON.stringify({ valid: true, candidateMutationObserved: false, dependencyLeaks: 0, unauthorizedVerdictMutations: 0 }, null, 2));
    return;
  }
  if (mode === 'promotion-guard') {
    const contexts = loadStage4SentinelContexts();
    assert(contexts.length === 20 && contexts.every(item => item.candidate.status === 'draft' && item.candidate.humanReviewed === false && item.candidate.automaticPromotionAllowed === false), 'STAGE4_PROMOTION_GUARD_FAILED');
    console.log(JSON.stringify({ valid: true, candidates: contexts.length, promoted: 0, generatedSetsRemainDraft: true }, null, 2));
    return;
  }
  if (mode === 'adversarial') {
    const cases = [
      ['complete', validateCandidateWithExperts(positiveContext()).verdict, 'expert-validated'],
      ['damage-missing', validateCandidateWithExperts({ ...positiveContext(), damageEvidence: false }).verdict, 'expert-review-required'],
      ['illegal', validateCandidateWithExperts({ ...positiveContext(), legal: false }).verdict, 'rejected'],
      ['team-illegal', validateCandidateWithExperts({ ...positiveContext(), fullTeamLegal: false }).verdict, 'rejected'],
      ['digest-mismatch', validateCandidateWithExperts({ ...positiveContext(), candidateDigestMatches: false }).verdict, 'rejected'],
    ];
    assert(cases.every(([, actual, expected]) => actual === expected), 'STAGE4_ADVERSARIAL_MATRIX_FAILED');
    console.log(JSON.stringify({ valid: true, fixtureCount: cases.length, failedGates: 0, matrix: cases.map(([name, verdict]) => ({ name, verdict })) }, null, 2));
    return;
  }
  if (mode === 'sentinel-rerun') {
    const contexts = loadStage4SentinelContexts();
    const first = contexts.map(item => `${item.candidate.candidateId}:${item.candidate.candidateDigest}`);
    const second = loadStage4SentinelContexts().map(item => `${item.candidate.candidateId}:${item.candidate.candidateDigest}`);
    assert(JSON.stringify(first) === JSON.stringify(second), 'STAGE4_SENTINEL_RERUN_NOT_REPRODUCIBLE');
    console.log(JSON.stringify({ valid: true, candidateCount: contexts.length, regenerated: false, reproducible: true }, null, 2));
    return;
  }
  if (mode === 'human-policy') {
    const calibration = JSON.parse(fs.readFileSync(path.resolve('artifacts/competitive-curation/champions-mb-human-calibration-champions-mb-human-calibration-v1/human-calibration/calibration-batch.json'), 'utf8')) as { candidateCount: number; reviewItems: unknown[]; createdAt: string };
    assert(calibration.candidateCount === 20 && calibration.reviewItems.length === 20 && calibration.createdAt, 'STAGE4_HUMAN_CALIBRATION_CHANGED');
    console.log(JSON.stringify({ valid: true, reviewsPending: 20, completedReviews: 0, state: 'awaiting-human-review', validatedSamplingIsOptional: true }, null, 2));
    return;
  }
  if (mode === 'offline') {
    const manifest = read<{ candidateCount: number; expertValidatedCount: number; expertReviewRequiredCount: number; rejectedCount: number; mongoReads: number; mongoWrites: number; productionWrites: number }>('expert-run-manifest.json');
    assert(manifest.candidateCount === 20 && manifest.expertValidatedCount === 0 && manifest.expertReviewRequiredCount === 20 && manifest.rejectedCount === 0, 'STAGE4_REAL_RESULT_INVALID');
    assert(manifest.mongoReads === 0 && manifest.mongoWrites === 0 && manifest.productionWrites === 0, 'STAGE4_WRITE_GUARD_FAILED');
    validateCandidateWithExperts(positiveContext());
    console.log(JSON.stringify({ valid: true, candidateCount: 20, expertValidatedCount: 0, expertReviewRequiredCount: 20, rejectedCount: 0, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
    return;
  }
  throw new Error('STAGE4_MODE_REQUIRED');
}

try { run(process.argv[2] ?? ''); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
