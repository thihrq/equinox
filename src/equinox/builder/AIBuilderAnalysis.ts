export type AIBuilderProfileId =
  | 'recommended'
  | 'offensive'
  | 'defensive'
  | 'anti_meta'
  | 'creative'
  | 'tempo'
  | 'balanced'
  | 'gauntlet'
  | 'regulation';

export type AIBuilderRiskLevel = 'Low' | 'Medium' | 'High';

export interface AIBuilderProfile {
  id: AIBuilderProfileId;
  name: string;
  summary: string;
}

export interface AIBuilderScores {
  defense: number;
  offense: number;
  roles: number;
  speed: number;
  threats: number;
  matchups: number;
  coach: number;
  metaFit: number;
  gauntletFit?: number;
  regulationFit?: number;
  total: number;
}

export interface AIBuilderAnalysis {
  profile: AIBuilderProfile;
  confidence: number;
  decisionScore: number;
  riskLevel: AIBuilderRiskLevel;
  scores: AIBuilderScores;
  strengths: string[];
  concerns: string[];
  priorities: string[];
  playstyleTags: string[];
  recommendedLead?: string;
  primaryWinCondition?: string;
  battlePlanSummary: string;
}
