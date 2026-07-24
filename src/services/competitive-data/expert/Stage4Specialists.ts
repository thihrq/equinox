import crypto from 'crypto';
import { ExpertEvidence, ExpertFinding } from './CompetitiveDoublesExpertTypes';
import { Stage4CandidateContext, Stage4SpecialistResult } from './Stage4ExpertTypes';
import { STAGE4_SPECIALIST_VERSIONS, Stage4SpecialistId } from './Stage4SpecialistContracts';

function digest(value: unknown): string { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
function makeFinding(code: string, message: string, blocking: boolean): ExpertFinding { return { code, message, severity: blocking ? 'error' : 'warning', blocking, evidenceIds: [] }; }

function run(id: Stage4SpecialistId, context: Stage4CandidateContext, blockers: string[], warnings: string[], confidence: Stage4SpecialistResult['confidence']): Stage4SpecialistResult {
  const version = STAGE4_SPECIALIST_VERSIONS[id];
  const inputDigest = digest({ id, version, candidate: context.candidate, context: { legal: context.legal, coherent: context.coherent, rolesSupported: context.rolesSupported, generationResolved: context.generationResolved, formResolved: context.formResolved, damageEvidence: context.damageEvidence, speedEvidence: context.speedEvidence, scenarioEvidenceCount: context.scenarioEvidenceCount, fullTeamEvidenceCount: context.fullTeamEvidenceCount, benchmarkEvidence: context.benchmarkEvidence, unsupportedMechanics: context.unsupportedMechanics } });
  const findings = [...blockers.map(code => makeFinding(code, `${id} detected ${code}`, true)), ...warnings.map(code => makeFinding(code, `${id} reported ${code}`, false))];
  const outputDigest = digest({ id, version, inputDigest, blockers, warnings, confidence });
  const evidence: ExpertEvidence[] = [{ evidenceId: `${id}:${context.candidate.candidateId}`, kind: 'audit', sourceId: 'equinox-stage4-specialist', sourceRevision: version, inputDigest, resultDigest: outputDigest, description: `Independent ${id} result; no other specialist output was provided.` }];
  return { specialistId: id, specialistVersion: version, valid: blockers.length === 0, reasonCodes: [...blockers, ...warnings], blockers, warnings, confidence, inputDigest, outputDigest, evidence, findings };
}

export const runLegalitySpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('deterministic-legality', context, [
  ...(!context.legal ? ['EXPERT_ILLEGAL_SET'] : []),
  ...(!context.generationResolved ? ['EXPERT_GENERATION_UNRESOLVED'] : []),
  ...(!context.formResolved ? ['EXPERT_FORM_UNRESOLVED'] : []),
  ...(context.candidateDigestMatches === false ? ['EXPERT_CANDIDATE_DIGEST_MISMATCH'] : []),
], [], context.legal && context.generationResolved && context.formResolved ? 'high' : 'low');

export const runDamageSpeedSpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('damage-speed', context, [], [
  ...(!context.damageEvidence ? ['EXPERT_EVIDENCE_DAMAGE_INCOMPLETE'] : []),
  ...(!context.speedEvidence ? ['EXPERT_EVIDENCE_SPEED_INCOMPLETE'] : []),
  ...(context.unsupportedMechanics.length > 0 ? ['EXPERT_UNSUPPORTED_ESSENTIAL_MECHANIC'] : []),
], context.damageEvidence && context.speedEvidence && context.unsupportedMechanics.length === 0 ? 'high' : 'low');

export const runCoherenceSpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('set-coherence', context, context.coherent ? [] : ['EXPERT_SET_INCOHERENT'], [], context.coherent ? 'high' : 'low');
export const runRoleSpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('role-archetype', context, context.rolesSupported ? [] : ['EXPERT_ROLE_UNSUPPORTED'], [], context.rolesSupported ? 'high' : 'low');

export const runDoublesStrategySpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('doubles-strategy', context, context.scenarioEvidenceCount >= 6 ? [] : ['EXPERT_EVIDENCE_SCENARIOS_INSUFFICIENT'], context.adverseScenarioCount > 0 ? ['EXPERT_ADVERSE_SCENARIOS_PRESENT'] : [], context.scenarioEvidenceCount >= 6 ? 'medium' : 'low');
export const runFullTeamSpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('full-team', context, [
  ...(context.fullTeamEvidenceCount >= 5 && !context.fullTeamLegal ? ['EXPERT_TEAM_ILLEGAL'] : []),
], context.fullTeamEvidenceCount < 5 ? ['EXPERT_EVIDENCE_FULL_TEAM_INSUFFICIENT'] : [], context.fullTeamEvidenceCount >= 5 && context.fullTeamLegal ? 'medium' : 'low');
export const runBenchmarkSpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('competitive-benchmark', context, [], context.benchmarkEvidence ? [] : ['EXPERT_EVIDENCE_BENCHMARK_INCOMPLETE'], context.benchmarkEvidence ? 'medium' : 'low');
// Wave 1D: Critical Review returns structured findings (category + materiality), never a
// blocker directly (mission section 7: "Não obrigar o Critical Review a produzir blocker
// diretamente" -- the orchestrator/aggregation policy interprets severity and materiality).
// The adverse-scenario finding is ratio-based rather than "any adverse scenario at all": the
// mission's own TDD contract (Case 2) specifically names 100% adverse as the material case,
// distinguishing it from a candidate that is merely not universally favored (Case 7).
function criticalReviewFinding(code: string, category: ExpertFinding['category'], materiality: ExpertFinding['materiality'], message: string): ExpertFinding {
  return { code, message, severity: materiality === 'review-required' ? 'warning' : 'info', blocking: false, evidenceIds: [], specialistId: 'critical-review', category, materiality };
}

export const runCriticalReviewSpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => {
  const id: Stage4SpecialistId = 'critical-review';
  const version = STAGE4_SPECIALIST_VERSIONS[id];
  const inputDigest = digest({ id, version, candidate: context.candidate, context: { scenarioEvidenceCount: context.scenarioEvidenceCount, adverseScenarioCount: context.adverseScenarioCount, fullTeamEvidenceCount: context.fullTeamEvidenceCount, unsupportedMechanics: context.unsupportedMechanics, criticalReviewSignals: context.criticalReviewSignals ?? null } });

  const findings: ExpertFinding[] = [];
  const adverseRatio = context.scenarioEvidenceCount > 0 ? context.adverseScenarioCount / context.scenarioEvidenceCount : 0;
  if (context.scenarioEvidenceCount > 0 && adverseRatio >= 1) {
    findings.push(criticalReviewFinding('EXPERT_CRITICAL_ALL_SCENARIOS_ADVERSE', 'strategic-risk', 'review-required', `all ${context.scenarioEvidenceCount} evaluated scenarios are adverse to this candidate`));
  } else if (adverseRatio > 0) {
    findings.push(criticalReviewFinding('EXPERT_CRITICAL_ADVERSE_SCENARIOS_PRESENT', 'strategic-risk', 'confidence-degrading', `${context.adverseScenarioCount}/${context.scenarioEvidenceCount} evaluated scenarios are adverse`));
  }
  if (context.unsupportedMechanics.length > 0) findings.push(criticalReviewFinding('EXPERT_CRITICAL_UNSUPPORTED_MECHANIC', 'unsupported-mechanic', 'review-required', `unsupported material mechanic(s): ${context.unsupportedMechanics.join(', ')}`));
  if (context.fullTeamEvidenceCount < 5) findings.push(criticalReviewFinding('EXPERT_CRITICAL_FULL_TEAM_GAP', 'full-team', 'review-required', `only ${context.fullTeamEvidenceCount}/5 full-team structures evaluated`));
  const signals = context.criticalReviewSignals ?? {};
  if (signals.candidateDominated) findings.push(criticalReviewFinding('EXPERT_CRITICAL_CANDIDATE_DOMINATED', 'candidate-dominated', 'review-required', 'candidate is dominated by a legal alternative across every benchmark dimension'));
  if (signals.excessivePartnerDependency) findings.push(criticalReviewFinding('EXPERT_CRITICAL_EXCESSIVE_PARTNER_DEPENDENCY', 'partner-dependency', 'review-required', 'candidate value depends materially on a specific fixed partner combination'));
  if (signals.noWinCondition) findings.push(criticalReviewFinding('EXPERT_CRITICAL_NO_WIN_CONDITION', 'strategic-risk', 'review-required', 'no identifiable win condition across the evaluated evidence'));
  if (signals.fullTeamRiskMaterial) findings.push(criticalReviewFinding('EXPERT_CRITICAL_FULL_TEAM_RISK_MATERIAL', 'full-team', 'review-required', 'material full-team risk identified beyond raw structure count'));
  if (signals.coverageInsufficient) findings.push(criticalReviewFinding('EXPERT_CRITICAL_COVERAGE_INSUFFICIENT', 'strategic-risk', 'review-required', 'type/role coverage evaluated as insufficient'));
  if (signals.contradictoryEvidence) findings.push(criticalReviewFinding('EXPERT_CRITICAL_CONTRADICTORY_EVIDENCE', 'evidence', 'review-required', 'contradictory evidence found across specialists'));

  const hasMaterialFinding = findings.some(item => item.materiality === 'review-required');
  const confidence: Stage4SpecialistResult['confidence'] = hasMaterialFinding ? 'low' : findings.length > 0 ? 'medium' : 'high';
  const reasonCodes = findings.map(item => item.code);
  const outputDigest = digest({ id, version, inputDigest, reasonCodes, confidence });
  const evidence: ExpertEvidence[] = [{ evidenceId: `${id}:${context.candidate.candidateId}`, kind: 'audit', sourceId: 'equinox-stage4-specialist', sourceRevision: version, inputDigest, resultDigest: outputDigest, description: 'Independent critical-review result; structured findings with category/materiality, never a direct blocker.' }];
  return { specialistId: id, specialistVersion: version, valid: true, reasonCodes, blockers: [], warnings: reasonCodes, confidence, inputDigest, outputDigest, evidence, findings };
};

export const runFormatRulesSpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('format-rules', context, context.generationResolved && context.formResolved ? [] : ['EXPERT_FORMAT_RULE_CONTEXT_INCOMPLETE'], [], context.generationResolved && context.formResolved ? 'high' : 'low');
export const runExportIntegritySpecialist = (context: Stage4CandidateContext): Stage4SpecialistResult => run('export-integrity', context, context.candidate.candidateDigest ? [] : ['EXPERT_EXPORT_CANDIDATE_ID_MISSING'], [], context.candidate.candidateDigest ? 'high' : 'low');

export const STAGE4_INDEPENDENT_SPECIALISTS = [runLegalitySpecialist, runDamageSpeedSpecialist, runCoherenceSpecialist, runRoleSpecialist, runDoublesStrategySpecialist, runFullTeamSpecialist, runBenchmarkSpecialist, runCriticalReviewSpecialist, runFormatRulesSpecialist, runExportIntegritySpecialist] as const;
