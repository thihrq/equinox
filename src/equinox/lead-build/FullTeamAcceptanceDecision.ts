import { FullTeamEvaluation } from '../vgc/LeadBuildTypes';
import { validateCompetitiveTeam, TeamLegalityResult } from '../competitive/CompetitiveTeamLegalityValidator';
import { StructuredGateReason, toStructuredGateReason } from './StrategyQualityDiagnostics';

export interface FinalistGateDecision {
  gate: string;
  valid: boolean;
  score?: number;
  threshold?: number;
  reasons: StructuredGateReason[];
}

export interface FullTeamAcceptanceDecision {
  accepted: boolean;
  gates: readonly FinalistGateDecision[];
  failedReasonCodes: readonly string[];
}

/**
 * Só anexa a metadata das 5 dimensões quando ela existe E o gate realmente
 * falhou — evita transportar evidência de déficit para um time aprovado.
 */
function buildOverallScoreReasons(evaluation: FullTeamEvaluation): StructuredGateReason[] {
  if (evaluation.overallScore >= 60) return [];
  if (!evaluation.overallScoreDeficitMetadata) {
    return [toStructuredGateReason('OVERALL_SCORE_BELOW_THRESHOLD')];
  }
  return [{ reasonCode: 'OVERALL_SCORE_BELOW_THRESHOLD', metadata: evaluation.overallScoreDeficitMetadata }];
}

export function decideFullTeamAcceptance(params: {
  legality: TeamLegalityResult;
  evaluation: FullTeamEvaluation;
}): FullTeamAcceptanceDecision {
  const { legality, evaluation } = params;
  const quality = evaluation.qualityResult;
  const defensive = evaluation.defensiveQuality;

  const hasSetCoherenceFailure = quality?.reasons?.some(
    (r: StructuredGateReason) => r.reasonCode === 'SET_COHERENCE_FAILURE',
  ) ?? false;

  const gates: FinalistGateDecision[] = [
    {
      gate: 'Legality',
      valid: legality.legal,
      reasons: legality.issues.map((issue: { message: string }) => toStructuredGateReason(issue.message)),
    },
    {
      gate: 'StrategyCompleteness',
      valid: evaluation.strategyComplete,
      reasons: evaluation.strategyComplete ? [] : [toStructuredGateReason('INCOMPLETE_STRATEGY')],
    },
    {
      gate: 'OverallScore',
      valid: evaluation.overallScore >= 60,
      score: evaluation.overallScore,
      threshold: 60,
      reasons: buildOverallScoreReasons(evaluation),
    },
    {
      gate: 'RoleCoverage',
      valid: evaluation.roleCoverageScore >= 55,
      score: evaluation.roleCoverageScore,
      threshold: 55,
      reasons: evaluation.roleCoverageScore >= 55 ? [] : [toStructuredGateReason('INSUFFICIENT_ROLE_COVERAGE')],
    },
    {
      gate: 'OffensiveQuality',
      valid: quality?.valid ?? evaluation.offensiveBalanceScore >= 45,
      score: quality?.contextualOffensiveScore ?? evaluation.offensiveBalanceScore,
      threshold: 45,
      reasons: [...(quality?.reasons ?? [])],
    },
    {
      gate: 'DefensiveQuality',
      valid: defensive?.valid ?? true,
      score: defensive?.score,
      reasons: (defensive?.reasons.map(reason => {
        const type = defensive.highestExposureType;
        return toStructuredGateReason(type ? `${reason}:${type}` : reason);
      }) ?? []),
    },
    {
      gate: 'SetCoherence',
      valid: !hasSetCoherenceFailure,
      reasons: hasSetCoherenceFailure ? [toStructuredGateReason('SET_COHERENCE_FAILURE')] : [],
    },
  ];

  const accepted = gates.every(g => g.valid);
  const failedReasonCodes = gates.filter(g => !g.valid).flatMap(g => g.reasons.map(r => r.reasonCode));

  return {
    accepted,
    gates,
    failedReasonCodes,
  };
}
