import fs from 'fs';
import path from 'path';
import { assertStage4Flags, classifyHumanReviewRequirement, selectHumanSampling, STAGE4_POLICY_VERSION, STAGE4_SAMPLING_POLICY_VERSION } from '../services/competitive-data/expert/Stage4ExpertPolicy';
import { validateCandidateWithExperts, stage4VerdictDigest } from '../services/competitive-data/expert/Stage4ExpertOrchestrator';
import { loadStage4SentinelContexts, loadStage4SourceArtifacts } from '../services/competitive-data/expert/Stage4SentinelData';
import { Stage4CandidateValidationResult, Stage4VerdictTransition } from '../services/competitive-data/expert/Stage4ExpertTypes';

declare const process: { env: Record<string, string | undefined>; argv: string[]; exitCode?: number };

export const STAGE4_RUN_ID = 'champions-mb-expert-validation-v1';
const CURATION_RUN_ID = 'champions-mb-sentinel-champions-mb-sentinel-v1';
const AUDIT_RUN_ID = 'champions-mb-adversarial-champions-mb-adversarial-v1';

function writeJson(file: string, value: unknown): void { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }

export interface Stage4Summary { expertRunId: string; candidateCount: number; expertValidatedCount: number; expertReviewRequiredCount: number; rejectedCount: number; samplingCount: number; results: Stage4CandidateValidationResult[]; transitions: Stage4VerdictTransition[]; artifactRoot: string; }

export function runStage4Validation(): Stage4Summary {
  assertStage4Flags(process.env);
  const contexts = loadStage4SentinelContexts();
  if (contexts.length !== 20) throw new Error('STAGE4_SENTINEL_COUNT_INVALID');
  const results = contexts.map(context => validateCandidateWithExperts(context));
  const root = path.resolve(`artifacts/competitive-curation/${CURATION_RUN_ID}/expert-validation/${STAGE4_RUN_ID}`);
  const transitions: Stage4VerdictTransition[] = results.map(result => ({ candidateId: result.candidateId, candidateDigest: result.candidateDigest, previousVerdict: 'agent-reviewed', expertVerdict: result.verdict, confidence: result.confidence, humanReviewRequirement: result.humanReviewRequirement, changed: result.verdict !== 'expert-validated', reasonCodes: result.reasonCodes }));
  const samplingCandidates = contexts.map((context, index) => ({ candidateId: context.candidate.candidateId, archetype: context.archetype, mega: context.isMega, regional: context.isRegional, trickRoom: context.hasTrickRoom, tailwind: context.hasTailwind, weather: context.hasWeather, terrain: context.hasTerrain, verdict: results[index].verdict, confidence: results[index].confidence }));
  const samplingSelection = selectHumanSampling(samplingCandidates, 'champions-mb-expert-validation-v1');
  const source = loadStage4SourceArtifacts();
  const metadata = { expertRunId: STAGE4_RUN_ID, sourceCurationRunId: CURATION_RUN_ID, sourceAuditRunId: AUDIT_RUN_ID, regulationId: 'M-B', packageDigest: source.calibrationBatch.packageDigest, rosterDigest: source.calibrationBatch.rosterDigest, mechanicsDigest: source.calibrationBatch.mechanicsDigest, policyVersion: STAGE4_POLICY_VERSION, samplingPolicyVersion: STAGE4_SAMPLING_POLICY_VERSION, candidateCount: 20, expertValidatedCount: results.filter(result => result.verdict === 'expert-validated').length, expertReviewRequiredCount: results.filter(result => result.verdict === 'expert-review-required').length, rejectedCount: results.filter(result => result.verdict === 'rejected').length, humanReviewRequiredCount: results.filter(result => result.humanReviewRequirement === 'required').length, humanSamplingCount: samplingSelection.length, generatedSetsRemainDraft: true, automaticPromotionAllowed: false, mongoReads: 0, mongoWrites: 0, productionWrites: 0 };
  writeJson(path.join(root, 'expert-run-manifest.json'), metadata);
  writeJson(path.join(root, 'specialist-results.json'), results.flatMap(result => result.specialistResults.map(specialist => ({ candidateId: result.candidateId, candidateDigest: result.candidateDigest, ...specialist }))));
  writeJson(path.join(root, 'legality-results.json'), results.map(result => ({ candidateId: result.candidateId, verdict: result.verdict, specialist: result.specialistResults.find(item => item.specialistId === 'deterministic-legality') })));
  writeJson(path.join(root, 'generation-results.json'), contexts.map(context => ({ candidateId: context.candidate.candidateId, generationResolved: context.generationResolved, formResolved: context.formResolved })));
  writeJson(path.join(root, 'damage-analysis.json'), results.map(result => ({ candidateId: result.candidateId, evidenceComplete: result.specialistResults.find(item => item.specialistId === 'damage-speed')?.valid ?? false })));
  writeJson(path.join(root, 'speed-analysis.json'), results.map(result => ({ candidateId: result.candidateId, evidenceComplete: result.specialistResults.find(item => item.specialistId === 'damage-speed')?.valid ?? false })));
  writeJson(path.join(root, 'scenario-analysis.json'), contexts.map(context => ({ candidateId: context.candidate.candidateId, scenarioCount: context.scenarioEvidenceCount, favorable: context.favorableScenarioCount, adverse: context.adverseScenarioCount })));
  writeJson(path.join(root, 'full-team-analysis.json'), contexts.map(context => ({ candidateId: context.candidate.candidateId, fullTeamCount: context.fullTeamEvidenceCount, legal: context.fullTeamLegal })));
  writeJson(path.join(root, 'benchmark-analysis.json'), results.map(result => ({ candidateId: result.candidateId, evidenceComplete: result.specialistResults.find(item => item.specialistId === 'competitive-benchmark')?.valid ?? false })));
  writeJson(path.join(root, 'critical-review-results.json'), results.map(result => ({ candidateId: result.candidateId, specialist: result.specialistResults.find(item => item.specialistId === 'critical-review') })));
  writeJson(path.join(root, 'evidence-audit-results.json'), results.map(result => ({ candidateId: result.candidateId, ...result.evidenceAudit })));
  writeJson(path.join(root, 'final-expert-verdicts.json'), results.map(result => ({ candidateId: result.candidateId, candidateDigest: result.candidateDigest, verdict: result.verdict, confidence: result.confidence, humanReviewRequirement: result.humanReviewRequirement, reasonCodes: result.reasonCodes, evidenceDigest: result.evidenceAudit.evidenceDigest, expertValidation: result.expertValidation })));
  writeJson(path.join(root, 'human-review-requirements.json'), results.map(result => ({ candidateId: result.candidateId, verdict: result.verdict, confidence: result.confidence, humanReviewRequirement: result.humanReviewRequirement })));
  writeJson(path.join(root, 'sampling-selection.json'), { policyVersion: STAGE4_SAMPLING_POLICY_VERSION, seed: 'champions-mb-expert-validation-v1', selectedCandidateIds: samplingSelection, selectedCount: samplingSelection.length });
  writeJson(path.join(root, 'verdict-transitions.json'), transitions);
  writeJson(path.join(root, 'reports/expert-validation-summary.json'), metadata);
  writeJson(path.join(root, 'reports/expert-review-required-report.json'), results.filter(result => result.verdict === 'expert-review-required').map(result => ({ candidateId: result.candidateId, reasonCodes: result.reasonCodes })));
  writeJson(path.join(root, 'reports/rejected-report.json'), results.filter(result => result.verdict === 'rejected'));
  writeJson(path.join(root, 'reports/unsupported-mechanics-impact-report.json'), { unsupportedMechanics: [...new Set(contexts.flatMap(context => context.unsupportedMechanics))], impact: 'essential per-candidate damage, speed and benchmark evidence is incomplete; drafts require human review' });
  writeJson(path.join(root, 'reports/human-sampling-report.json'), { selectedCandidateIds: samplingSelection, policyVersion: STAGE4_SAMPLING_POLICY_VERSION, existingCalibrationBatchPreserved: true, completedReviews: 0, reviewsPending: 20 });
  return { ...metadata, results, transitions, samplingCount: samplingSelection.length, artifactRoot: root };
}

function main(): void {
  try {
    const summary = runStage4Validation();
    console.log(JSON.stringify({ expertRunId: summary.expertRunId, candidateCount: summary.candidateCount, expertValidatedCount: summary.expertValidatedCount, expertReviewRequiredCount: summary.expertReviewRequiredCount, rejectedCount: summary.rejectedCount, samplingCount: summary.samplingCount, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
    if (summary.expertReviewRequiredCount > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

if (process.argv[1]?.endsWith('runChampionsExpertValidation.ts')) main();
