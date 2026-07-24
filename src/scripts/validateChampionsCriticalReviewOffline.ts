import fs from 'fs';
import path from 'path';
import { runCriticalReviewSpecialist } from '../services/competitive-data/expert/Stage4Specialists';
import { Stage4CandidateContext } from '../services/competitive-data/expert/Stage4ExpertTypes';

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
    candidate: { candidateId: 'critical-review-check', candidateDigest: 'sha256:candidate', sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false },
    legal: true, coherent: true, rolesSupported: true, generationResolved: true, formResolved: true,
    damageEvidence: true, speedEvidence: true, scenarioEvidenceCount: 6, favorableScenarioCount: 6, adverseScenarioCount: 0,
    fullTeamEvidenceCount: 5, fullTeamLegal: true, benchmarkEvidence: true, unsupportedMechanics: [],
    packageDigest: 'sha256:package', mechanicsDigest: 'sha256:mechanics', rosterDigest: 'sha256:roster',
    previousVerdict: 'agent-reviewed', archetype: 'balanced', isMega: false, isRegional: false,
    hasTrickRoom: false, hasTailwind: false, hasWeather: false, hasTerrain: false,
    ...overrides,
  };
}

const CASES: { id: string; overrides: Partial<Stage4CandidateContext>; expectCode: string | null; expectConfidence: 'high' | 'medium' | 'low' }[] = [
  { id: 'no-findings', overrides: {}, expectCode: null, expectConfidence: 'high' },
  { id: 'all-scenarios-adverse', overrides: { adverseScenarioCount: 6, favorableScenarioCount: 0 }, expectCode: 'EXPERT_CRITICAL_ALL_SCENARIOS_ADVERSE', expectConfidence: 'low' },
  { id: 'partial-scenarios-adverse', overrides: { adverseScenarioCount: 2, favorableScenarioCount: 4 }, expectCode: 'EXPERT_CRITICAL_ADVERSE_SCENARIOS_PRESENT', expectConfidence: 'medium' },
  { id: 'unsupported-mechanic', overrides: { unsupportedMechanics: ['x'] }, expectCode: 'EXPERT_CRITICAL_UNSUPPORTED_MECHANIC', expectConfidence: 'low' },
  { id: 'full-team-gap', overrides: { fullTeamEvidenceCount: 2 }, expectCode: 'EXPERT_CRITICAL_FULL_TEAM_GAP', expectConfidence: 'low' },
  { id: 'candidate-dominated', overrides: { criticalReviewSignals: { candidateDominated: true } }, expectCode: 'EXPERT_CRITICAL_CANDIDATE_DOMINATED', expectConfidence: 'low' },
  { id: 'excessive-partner-dependency', overrides: { criticalReviewSignals: { excessivePartnerDependency: true } }, expectCode: 'EXPERT_CRITICAL_EXCESSIVE_PARTNER_DEPENDENCY', expectConfidence: 'low' },
  { id: 'no-win-condition', overrides: { criticalReviewSignals: { noWinCondition: true } }, expectCode: 'EXPERT_CRITICAL_NO_WIN_CONDITION', expectConfidence: 'low' },
  { id: 'full-team-risk-material', overrides: { criticalReviewSignals: { fullTeamRiskMaterial: true } }, expectCode: 'EXPERT_CRITICAL_FULL_TEAM_RISK_MATERIAL', expectConfidence: 'low' },
  { id: 'coverage-insufficient', overrides: { criticalReviewSignals: { coverageInsufficient: true } }, expectCode: 'EXPERT_CRITICAL_COVERAGE_INSUFFICIENT', expectConfidence: 'low' },
  { id: 'contradictory-evidence', overrides: { criticalReviewSignals: { contradictoryEvidence: true } }, expectCode: 'EXPERT_CRITICAL_CONTRADICTORY_EVIDENCE', expectConfidence: 'low' },
];

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId}/tests`;

  const results = CASES.map(testCase => {
    const specialistResult = runCriticalReviewSpecialist(context(testCase.overrides));
    const codes = specialistResult.findings.map(finding => finding.code);
    const hasExpectedCode = testCase.expectCode === null ? codes.length === 0 : codes.includes(testCase.expectCode);
    const neverProducesBlocker = specialistResult.blockers.length === 0;
    return {
      id: testCase.id, expectCode: testCase.expectCode, actualCodes: codes,
      expectConfidence: testCase.expectConfidence, actualConfidence: specialistResult.confidence,
      neverProducesBlocker, pass: hasExpectedCode && specialistResult.confidence === testCase.expectConfidence && neverProducesBlocker,
      findings: specialistResult.findings.map(finding => ({ code: finding.code, category: finding.category, materiality: finding.materiality })),
    };
  });
  const failed = results.filter(result => !result.pass);
  const allNeverBlock = results.every(result => result.neverProducesBlocker);

  const result = {
    valid: failed.length === 0 && allNeverBlock, runId, caseCount: results.length, passed: results.length - failed.length, failed: failed.length,
    criticalReviewNeverProducesBlocker: allNeverBlock, results, mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };
  writeAtomic(path.resolve(outputDir, 'critical-review-tests.json'), result);
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 7;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
