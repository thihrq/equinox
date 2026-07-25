import fs from 'fs';
import path from 'path';
import { validateCandidateWithExperts } from '../services/competitive-data/expert/Stage4ExpertOrchestrator';
import { Stage4CandidateContext } from '../services/competitive-data/expert/Stage4ExpertTypes';
import { EXPERT_VERDICT_AGGREGATION_POLICY } from '../services/competitive-data/expert/ExpertVerdictAggregationPolicy';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function context(overrides: Partial<Stage4CandidateContext> = {}): Stage4CandidateContext {
  return {
    candidate: { candidateId: 'aggregation-check', candidateDigest: 'sha256:candidate', sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false },
    legal: true, coherent: true, rolesSupported: true, generationResolved: true, formResolved: true,
    damageEvidence: true, speedEvidence: true, scenarioEvidenceCount: 6, favorableScenarioCount: 5, adverseScenarioCount: 0,
    fullTeamEvidenceCount: 5, fullTeamLegal: true, benchmarkEvidence: true, unsupportedMechanics: [],
    packageDigest: 'sha256:package', mechanicsDigest: 'sha256:mechanics', rosterDigest: 'sha256:roster',
    previousVerdict: 'agent-reviewed', archetype: 'balanced', isMega: false, isRegional: false,
    hasTrickRoom: false, hasTailwind: false, hasWeather: false, hasTerrain: false,
    ...overrides,
  };
}

const CASES: { id: string; overrides: Partial<Stage4CandidateContext>; expectedVerdict: string; note: string }[] = [
  { id: 'case1-healthy', overrides: { scenarioEvidenceCount: 6, favorableScenarioCount: 4, adverseScenarioCount: 1 }, expectedVerdict: 'expert-validated', note: 'legal, complete evidence, no material Critical Review finding' },
  { id: 'case2-all-adverse', overrides: { scenarioEvidenceCount: 6, favorableScenarioCount: 0, adverseScenarioCount: 6 }, expectedVerdict: 'expert-review-required', note: '100% adverse scenarios must never be expert-validated/high' },
  { id: 'case3-missing-evidence', overrides: { speedEvidence: false }, expectedVerdict: 'expert-review-required', note: 'material evidence missing' },
  { id: 'case4-unsupported-mechanic', overrides: { unsupportedMechanics: ['x'] }, expectedVerdict: 'expert-review-required', note: 'material unsupported mechanic' },
  { id: 'case5-illegal', overrides: { legal: false }, expectedVerdict: 'rejected', note: 'illegality' },
  { id: 'case6-digest-mismatch', overrides: { candidateDigestMatches: false }, expectedVerdict: 'rejected', note: 'tampered/mismatched digest' },
  { id: 'case7-nonmaterial-warning', overrides: { scenarioEvidenceCount: 6, favorableScenarioCount: 4, adverseScenarioCount: 2 }, expectedVerdict: 'expert-validated', note: 'partial adverse scenarios must not auto-block' },
  { id: 'case9-dominated', overrides: { criticalReviewSignals: { candidateDominated: true } }, expectedVerdict: 'expert-review-required', note: 'candidate dominated by a legal alternative' },
  { id: 'case10-score-vs-blocker', overrides: { legal: false, scenarioEvidenceCount: 6, favorableScenarioCount: 6, adverseScenarioCount: 0 }, expectedVerdict: 'rejected', note: 'blocker prevails over otherwise-perfect evidence' },
];

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId}/tests`;

  const results = CASES.map(testCase => {
    const validation = validateCandidateWithExperts(context(testCase.overrides));
    return {
      id: testCase.id, note: testCase.note, expectedVerdict: testCase.expectedVerdict,
      actualVerdict: validation.verdict, actualConfidence: validation.confidence,
      pass: validation.verdict === testCase.expectedVerdict,
      policyId: validation.aggregationPolicyId, policyVersion: validation.aggregationPolicyVersion,
      materialFindings: (validation.materialFindings ?? []).map(finding => finding.code),
    };
  });
  const failed = results.filter(result => !result.pass);

  const result = {
    valid: failed.length === 0, runId, policyId: EXPERT_VERDICT_AGGREGATION_POLICY.policyId, policyVersion: EXPERT_VERDICT_AGGREGATION_POLICY.policyVersion,
    caseCount: results.length, passed: results.length - failed.length, failed: failed.length, results,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };
  writeAtomic(path.resolve(outputDir, 'aggregation-tdd-results.json'), result);
  console.log(JSON.stringify(result));
  if (failed.length > 0) process.exitCode = 7;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
