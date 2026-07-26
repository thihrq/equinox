import { TeamDefensiveProfile, DefensiveExposureIssue } from './TeamDefensiveProfile';
import { evaluateDefensiveQuality, DefensiveQualityResult } from './evaluateDefensiveQuality';
import { evaluateSpreadMoveExposure, SpreadMoveExposure } from './SpreadMoveExposureEvaluator';

export interface DefensiveQualityDiagnostics {
  profile: TeamDefensiveProfile;
  criticalExposures: readonly DefensiveExposureIssue[];
  defensiveScore: number;
  defensiveQuality: DefensiveQualityResult;
  spreadMoveExposure: readonly SpreadMoveExposure[];
}

export function diagnoseDefensiveQuality(
  team: readonly any[],
  profile: TeamDefensiveProfile,
): DefensiveQualityDiagnostics {
  const defensiveQuality = evaluateDefensiveQuality(profile);
  const spreadMoveExposure = evaluateSpreadMoveExposure(team, profile);

  return {
    profile,
    criticalExposures: profile.criticalExposures,
    defensiveScore: defensiveQuality.score,
    defensiveQuality,
    spreadMoveExposure,
  };
}
