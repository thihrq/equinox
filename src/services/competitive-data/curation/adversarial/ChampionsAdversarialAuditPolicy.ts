import { ChampionsAdversarialExpectedVerdict } from './ChampionsAdversarialAuditTypes';

export const ADVERSARIAL_POLICY_VERSION = 'champions-mb-sentinel-adversarial-audit-v1';
export const THRESHOLDS = { agentReviewed: 80, humanReviewRequired: 60, minimumFullTeamStructures: 5, minimumMatchupScenarios: 6 } as const;
export function verdictFor(score: number, hasBlocker: boolean, evidenceComplete: boolean): ChampionsAdversarialExpectedVerdict {
  if (hasBlocker) return 'rejected';
  if (!evidenceComplete || score < THRESHOLDS.agentReviewed) return 'human-review-required';
  return 'agent-reviewed';
}
