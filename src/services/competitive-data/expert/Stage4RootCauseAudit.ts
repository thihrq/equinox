import fs from 'fs';
import path from 'path';

export type Stage4RootCauseCategory = 'engine-coverage-gap' | 'evidence-generation-gap' | 'policy-threshold' | 'real-strategic-uncertainty' | 'meta-dependent' | 'battle-test-dependent' | 'data-quality-problem' | 'implementation-defect';

export interface Stage4RootCauseCandidate {
  candidateId: string;
  expertVerdict: string;
  confidence: string;
  blockingSpecialist: string[];
  blockingReasonCodes: string[];
  unsupportedMechanics: string[];
  missingEvidence: string[];
  failedThresholds: string[];
  requiredCalculations: string[];
  requiredMetaEvidence: string[];
  requiredBattleTesting: string[];
  categories: Stage4RootCauseCategory[];
}

export interface Stage4RootCauseSummary {
  candidateCount: number;
  expertValidatedCount: number;
  expertReviewRequiredCount: number;
  rejectedCount: number;
  reviewRequiredByEngineCoverage: number;
  reviewRequiredByMissingEvidence: number;
  reviewRequiredByPolicy: number;
  reviewRequiredByMeta: number;
  reviewRequiredByBattleTesting: number;
  reviewRequiredByTrueAmbiguity: number;
  reviewRequiredByDataQuality: number;
  reviewRequiredByImplementationDefect: number;
}

function readJson<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }

export function classifyStage4ReasonCode(reasonCode: string): Stage4RootCauseCategory {
  if (reasonCode.includes('ADVERSE') || reasonCode.includes('BATTLE')) return 'battle-test-dependent';
  if (reasonCode.includes('DAMAGE') || reasonCode.includes('SPEED') || reasonCode.includes('SCENARIO') || reasonCode.includes('FULL_TEAM')) return 'engine-coverage-gap';
  if (reasonCode.includes('BENCHMARK') || reasonCode.includes('META')) return 'meta-dependent';
  if (reasonCode.includes('THRESHOLD')) return 'policy-threshold';
  if (reasonCode.includes('AMBIGU')) return 'real-strategic-uncertainty';
  if (reasonCode.includes('INCOHERENT') || reasonCode.includes('ROLE_')) return 'data-quality-problem';
  if (reasonCode.includes('DIGEST') || reasonCode.includes('EXPORT_')) return 'implementation-defect';
  if (reasonCode.includes('EVIDENCE') || reasonCode.includes('UNSUPPORTED')) return 'evidence-generation-gap';
  return 'real-strategic-uncertainty';
}

export function auditStage4RootCauses(root: string): { candidates: Stage4RootCauseCandidate[]; summary: Stage4RootCauseSummary } {
  const verdicts = readJson<Array<{ candidateId: string; verdict: string; confidence: string; reasonCodes: string[] }>>(path.join(root, 'final-expert-verdicts.json'));
  const specialists = readJson<Array<{ candidateId: string; specialistId: string; reasonCodes: string[] }>>(path.join(root, 'specialist-results.json'));
  const candidates = verdicts.map(verdict => {
    const records = specialists.filter(item => item.candidateId === verdict.candidateId);
    const codes = [...new Set([...verdict.reasonCodes, ...records.flatMap(item => item.reasonCodes)])];
    const categories = [...new Set(codes.map(classifyStage4ReasonCode))];
    return {
      candidateId: verdict.candidateId,
      expertVerdict: verdict.verdict,
      confidence: verdict.confidence,
      blockingSpecialist: records.filter(item => item.reasonCodes.some(code => code.includes('INCOMPLETE') || code.includes('ILLEGAL'))).map(item => item.specialistId),
      blockingReasonCodes: codes,
      unsupportedMechanics: codes.filter(code => code.includes('UNSUPPORTED')),
      missingEvidence: codes.filter(code => code.includes('EVIDENCE')),
      failedThresholds: codes.filter(code => code.includes('THRESHOLD')),
      requiredCalculations: codes.filter(code => code.includes('DAMAGE') || code.includes('SPEED') || code.includes('SCENARIO') || code.includes('FULL_TEAM')),
      requiredMetaEvidence: codes.filter(code => code.includes('BENCHMARK') || code.includes('META')),
      requiredBattleTesting: codes.filter(code => code.includes('ADVERSE') || code.includes('BATTLE')),
      categories,
    };
  });
  const review = candidates.filter(candidate => candidate.expertVerdict === 'expert-review-required');
  const count = (category: Stage4RootCauseCategory): number => review.filter(candidate => candidate.categories.includes(category)).length;
  return {
    candidates,
    summary: {
      candidateCount: candidates.length,
      expertValidatedCount: candidates.filter(candidate => candidate.expertVerdict === 'expert-validated').length,
      expertReviewRequiredCount: review.length,
      rejectedCount: candidates.filter(candidate => candidate.expertVerdict === 'rejected').length,
      reviewRequiredByEngineCoverage: review.filter(candidate => candidate.requiredCalculations.length > 0).length,
      reviewRequiredByMissingEvidence: review.filter(candidate => candidate.missingEvidence.length > 0).length,
      reviewRequiredByPolicy: count('policy-threshold'),
      reviewRequiredByMeta: review.filter(candidate => candidate.requiredMetaEvidence.length > 0).length,
      reviewRequiredByBattleTesting: review.filter(candidate => candidate.requiredBattleTesting.length > 0).length,
      reviewRequiredByTrueAmbiguity: count('real-strategic-uncertainty'),
      reviewRequiredByDataQuality: count('data-quality-problem'),
      reviewRequiredByImplementationDefect: count('implementation-defect'),
    },
  };
}
