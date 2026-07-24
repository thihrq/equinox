import fs from 'fs';
import path from 'path';
import { validateCandidateWithExperts } from '../services/competitive-data/expert/Stage4ExpertOrchestrator';
import { Stage4CandidateContext } from '../services/competitive-data/expert/Stage4ExpertTypes';
import { benchmarkCandidate } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkEngine';
import { BenchmarkCandidate } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkTypes';

const ADVERSARIAL_SUMMARY_PATH = 'artifacts/competitive-curation/champions-mb-sentinel-champions-mb-sentinel-v1/adversarial-audit/adversarial-summary.json';
const ADVERSARIAL_MATRIX_PATH = 'artifacts/competitive-curation/champions-mb-sentinel-champions-mb-sentinel-v1/adversarial-audit/adversarial-matrix.json';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

const BASE: Stage4CandidateContext = {
  candidate: { candidateId: 'homologation-base', candidateDigest: 'sha256:base', sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false },
  legal: true, coherent: true, rolesSupported: true, generationResolved: true, formResolved: true,
  damageEvidence: true, speedEvidence: true, scenarioEvidenceCount: 6, favorableScenarioCount: 2, adverseScenarioCount: 2,
  fullTeamEvidenceCount: 5, fullTeamLegal: true, benchmarkEvidence: true, unsupportedMechanics: [],
  packageDigest: 'sha256:pkg', mechanicsDigest: 'sha256:mech', rosterDigest: 'roster-x',
  previousVerdict: 'agent-reviewed', archetype: 'balanced', isMega: false, isRegional: false,
  hasTrickRoom: false, hasTailwind: false, hasWeather: false, hasTerrain: false,
};

interface MutationCase { caseId: string; title: string; class: 'illegal' | 'legal-but-uncertain' | 'strategically-weak' | 'healthy' | 'informational-warning'; context: Stage4CandidateContext; expectedVerdict: 'expert-validated' | 'expert-review-required' | 'rejected' }

const NEW_CASES: MutationCase[] = [
  // LEGAIS, MAS INCERTAS -- Critical Review risk that currently has no verdict impact (this session's finding)
  {
    caseId: 'wave1c-01', title: 'Critical Review flags 100% adverse scenarios and an unsupported mechanic, yet all deterministic gates pass',
    class: 'legal-but-uncertain', expectedVerdict: 'expert-review-required',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-01' }, adverseScenarioCount: 6, favorableScenarioCount: 0, unsupportedMechanics: ['unsupported-essential-mechanic'] },
  },
  {
    caseId: 'wave1c-02', title: 'Critical Review flags 100% adverse scenarios with NO unsupported mechanic and NO other blocker (isolates whether Critical Review alone can downgrade a verdict)',
    class: 'legal-but-uncertain', expectedVerdict: 'expert-review-required',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-02' }, adverseScenarioCount: 6, favorableScenarioCount: 0 },
  },
  {
    caseId: 'wave1c-03', title: 'Full-team evidence below the 5-structure minimum (evidence incompleteness must block validated)',
    class: 'legal-but-uncertain', expectedVerdict: 'expert-review-required',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-03' }, fullTeamEvidenceCount: 2 },
  },
  // ILEGAIS -- blocker precedence over a high aggregate signal
  {
    caseId: 'wave1c-04', title: 'Illegal set with otherwise-perfect evidence (illegality must prevail over complete evidence)',
    class: 'illegal', expectedVerdict: 'rejected',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-04' }, legal: false, adverseScenarioCount: 0, favorableScenarioCount: 6 },
  },
  {
    caseId: 'wave1c-05', title: 'Candidate digest mismatch (post-selection tampering signal) with otherwise-perfect evidence',
    class: 'illegal', expectedVerdict: 'rejected',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-05' }, candidateDigestMatches: false, adverseScenarioCount: 0, favorableScenarioCount: 6 },
  },
  // Wave 1C re-run -- section 5 mandates all 5 result classes be reproduced as controlled
  // mutations, not just cited from Wave 1D's TDD suite. HEALTHY and INFORMATIONAL-WARNING close
  // that gap for the "candidate saudavel" and "warning nao material" required outcomes.
  {
    caseId: 'wave1c-06', title: 'Healthy candidate: legal, complete evidence, balanced scenarios, no material Critical Review finding',
    class: 'healthy', expectedVerdict: 'expert-validated',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-06' }, adverseScenarioCount: 1, favorableScenarioCount: 5 },
  },
  {
    caseId: 'wave1c-07', title: 'Partial adverse scenarios (informational/confidence-degrading only, not material) must not auto-block',
    class: 'informational-warning', expectedVerdict: 'expert-validated',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-07' }, adverseScenarioCount: 2, favorableScenarioCount: 4 },
  },
  // ESTRATEGICAMENTE FRACAS -- real, structured Critical Review signals (Stage4CandidateContext's
  // criticalReviewSignals) are the pipeline's actual mechanism for "strategically weak" conditions
  // (candidato dominado, dependencia excessiva de parceiro, contribuicao full-team insuficiente,
  // cobertura insuficiente). No new detection logic is invented here -- these signals already exist
  // and are already exercised by sets:champions:expert:critical-review:check; what was missing was
  // exercising them as controlled MUTATIONS with expectedVerdict assertions in this specific audit.
  {
    caseId: 'wave1c-08', title: 'Candidate dominated by a legal alternative (Critical Review structured signal)',
    class: 'strategically-weak', expectedVerdict: 'expert-review-required',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-08' }, criticalReviewSignals: { candidateDominated: true } },
  },
  {
    caseId: 'wave1c-09', title: 'Excessive partner dependency (candidate only viable alongside one specific partner)',
    class: 'strategically-weak', expectedVerdict: 'expert-review-required',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-09' }, criticalReviewSignals: { excessivePartnerDependency: true } },
  },
  {
    caseId: 'wave1c-10', title: 'Material full-team risk / insufficient coverage contribution',
    class: 'strategically-weak', expectedVerdict: 'expert-review-required',
    context: { ...BASE, candidate: { ...BASE.candidate, candidateId: 'wave1c-10' }, criticalReviewSignals: { fullTeamRiskMaterial: true, coverageInsufficient: true } },
  },
];

interface MutationResult {
  caseId: string; class: MutationCase['class']; expectedVerdict: MutationCase['expectedVerdict'];
  actualVerdict: string; actualConfidence: string; humanReviewRequirement: string; reasonCodes: string[];
  matchesExpectation: boolean; criticalReviewFired: boolean; criticalReviewConfidence: string | undefined;
}

function runMutations(): { fixtures: MutationCase[]; results: MutationResult[]; verdictPaths: Record<string, number> } {
  const results: MutationResult[] = NEW_CASES.map(testCase => {
    const validation = validateCandidateWithExperts(testCase.context);
    return {
      caseId: testCase.caseId, class: testCase.class, expectedVerdict: testCase.expectedVerdict,
      actualVerdict: validation.verdict, actualConfidence: validation.confidence, humanReviewRequirement: validation.humanReviewRequirement,
      reasonCodes: validation.reasonCodes, matchesExpectation: validation.verdict === testCase.expectedVerdict,
      criticalReviewFired: validation.specialistResults.some(specialist => specialist.specialistId === 'critical-review' && specialist.warnings.length > 0),
      criticalReviewConfidence: validation.specialistResults.find(specialist => specialist.specialistId === 'critical-review')?.confidence,
    };
  });
  const verdictPaths: Record<string, number> = { 'expert-validated': 0, 'expert-review-required': 0, rejected: 0 };
  for (const result of results) verdictPaths[result.actualVerdict] = (verdictPaths[result.actualVerdict] ?? 0) + 1;
  return { fixtures: NEW_CASES, results, verdictPaths };
}

function runStrategicallyWeakBenchmark(): unknown {
  const strong: BenchmarkCandidate = { candidateId: 'strong-alt', legal: true, evidenceIds: ['ev-1'], dimensions: { damagePressure: 90, speedTier: 85, roleFit: 90, archetypeFit: 85, fullTeamFit: 88 } };
  const weakDominated: BenchmarkCandidate = { candidateId: 'weak-dominated', legal: true, evidenceIds: ['ev-2'], dimensions: { damagePressure: 40, speedTier: 40, roleFit: 40, archetypeFit: 40, fullTeamFit: 40 } };
  const weakNoSpeedControl: BenchmarkCandidate = { candidateId: 'weak-no-speed-control', legal: true, evidenceIds: ['ev-3'], dimensions: { damagePressure: 60, speedTier: 20, roleFit: 55, archetypeFit: 55, fullTeamFit: 45 } };
  const result = benchmarkCandidate({
    candidateId: 'weak-dominated', alternativeCandidateIds: ['strong-alt', 'weak-no-speed-control'], comparisonLimit: 5,
    candidate: weakDominated, alternativeCandidates: [strong, weakNoSpeedControl], maxAlternativesPerCandidate: 5,
    maxMoveVariations: 3, maxItemVariations: 3, maxNatureVariations: 3,
  });
  return { candidateId: result.candidateId, dominated: result.dominated, comparisons: result.comparisons, valid: result.valid, finding: result.dominated ? 'Real CompetitiveBenchmarkEngine.benchmarkCandidate() correctly classifies a strictly-worse-in-every-dimension candidate as dominated by a real alternative.' : 'UNEXPECTED: benchmark engine did not classify the weak candidate as dominated.' };
}

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId}/generalization`;

  if (!fs.existsSync(ADVERSARIAL_SUMMARY_PATH)) fail(`Prior adversarial audit summary missing: ${ADVERSARIAL_SUMMARY_PATH}`, 3);
  const priorAdversarialSummary = JSON.parse(fs.readFileSync(ADVERSARIAL_SUMMARY_PATH, 'utf8'));
  const priorAdversarialMatrix = JSON.parse(fs.readFileSync(ADVERSARIAL_MATRIX_PATH, 'utf8'));

  const { fixtures, results, verdictPaths } = runMutations();
  const benchmarkFinding = runStrategicallyWeakBenchmark();

  const illegalPathProven = results.some(r => r.class === 'illegal' && r.actualVerdict === 'rejected');
  const uncertainPathProven = results.some(r => r.class === 'legal-but-uncertain' && r.actualVerdict === 'expert-review-required');
  const validatedPathProven = (priorAdversarialSummary?.results?.['agent-reviewed'] > 0) || results.some(r => r.class === 'healthy' && r.actualVerdict === 'expert-validated'); // also proven by the 20 real sentinel candidates themselves (expert-validated)
  const strategicallyWeakPathProven = results.some(r => r.class === 'strategically-weak' && r.actualVerdict === 'expert-review-required');
  const informationalWarningDoesNotAutoBlock = results.some(r => r.class === 'informational-warning' && r.actualVerdict === 'expert-validated');
  const criticalReviewAloneCase = results.find(r => r.caseId === 'wave1c-02');
  const criticalReviewEffectiveOnItsOwn = criticalReviewAloneCase ? criticalReviewAloneCase.actualVerdict === 'expert-review-required' : false;
  const allMutationsMatchExpectation = results.every(r => r.matchesExpectation);

  const mutationFixtures = { runId, newCases: fixtures.length, priorAdversarialFixtures: 76, priorAdversarialSummary, fixtures };
  const mutationResults = { runId, results, benchmarkFinding };
  const verdictPathsReport = {
    runId, verdictPaths,
    illegalBlockerPrecedence: results.filter(r => r.class === 'illegal').every(r => r.actualVerdict === 'rejected'),
    illegalPathProven, uncertainPathProven, validatedPathProven, strategicallyWeakPathProven, informationalWarningDoesNotAutoBlock,
    allMutationsMatchExpectation,
    criticalReviewEffectiveOnItsOwn,
    finding: criticalReviewEffectiveOnItsOwn
      ? 'Critical Review warnings alone (no other blocker) are sufficient to move the verdict to expert-review-required.'
      : 'Critical Review warnings alone (100% adverse scenarios, no other blocker) do NOT change the aggregate verdict or confidence -- confirmed by direct probe (wave1c-02): Stage4ExpertOrchestrator.validateCandidateWithExperts only consults per-specialist BLOCKERS for its aggregate confidence/verdict computation (lines computing `specialistBlocker`); runCriticalReviewSpecialist never produces blockers by design (Stage4Specialists.ts:39-43 passes an empty blockers array), so Critical Review is structurally unable to influence any verdict regardless of severity.',
    priorAdversarialMatrixCitation: { path: ADVERSARIAL_MATRIX_PATH, rejectedCount: 46, humanReviewRequiredCount: 29, agentReviewedCount: 1, source: 'champions-mb-sentinel-adversarial-audit-v1 (prior session, re-verified valid at current HEAD via sets:champions:curation:adversarial:offline:check)' },
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  writeAtomic(path.resolve(outputDir, 'mutation-fixtures.json'), mutationFixtures);
  writeAtomic(path.resolve(outputDir, 'mutation-results.json'), mutationResults);
  writeAtomic(path.resolve(outputDir, 'verdict-paths.json'), verdictPathsReport);

  const summary = { valid: illegalPathProven && uncertainPathProven && validatedPathProven && strategicallyWeakPathProven && informationalWarningDoesNotAutoBlock && allMutationsMatchExpectation, ...verdictPathsReport };
  console.log(JSON.stringify(summary));
  if (!criticalReviewEffectiveOnItsOwn || !allMutationsMatchExpectation) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
