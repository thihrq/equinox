import { TeamDefensiveProfile, DefensiveExposureIssue } from './TeamDefensiveProfile';

export interface DefensiveQualityDiagnostics {
  profile: TeamDefensiveProfile;
  criticalExposures: readonly DefensiveExposureIssue[];
  defensiveScore: number;
}

export function diagnoseDefensiveQuality(profile: TeamDefensiveProfile): DefensiveQualityDiagnostics {
  return {
    profile,
    criticalExposures: profile.criticalExposures,
    defensiveScore: profile.totalScore,
  };
}
