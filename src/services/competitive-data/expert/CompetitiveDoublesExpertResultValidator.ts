import { ExpertVerdict } from './CompetitiveDoublesExpertTypes';

export function validateExpertVerdictContract(verdict: ExpertVerdict): string[] {
  const errors: string[] = [];
  if (verdict.automaticPromotionAllowed !== false) errors.push('AUTOMATIC_PROMOTION_MUST_BE_FALSE');
  if (!['expert-validated', 'expert-review-required', 'rejected'].includes(verdict.decision)) errors.push('EXPERT_DECISION_INVALID');
  if (verdict.score < 0 || verdict.score > 100) errors.push('EXPERT_SCORE_OUT_OF_RANGE');
  if (verdict.candidate.status !== 'generated' || verdict.candidate.reviewStatus !== 'draft') errors.push('EXPERT_CANDIDATE_STATE_INVALID');
  return errors;
}
