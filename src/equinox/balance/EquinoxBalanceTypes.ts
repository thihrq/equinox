export type BalanceLevel =
  | 'Elite'
  | 'Strong'
  | 'Playable'
  | 'Creative'
  | 'Risky';

export type SetStyle =
  | 'Competitive Safe'
  | 'Balanced'
  | 'Creative Viable'
  | 'Offensive'
  | 'Support';

export type MatchupLevel =
  | 'Favored'
  | 'Even'
  | 'Playable'
  | 'Difficult'
  | 'Unsafe';

export interface RecommendedSet {
  pokemon: string;
  item: string;
  ability: string;
  nature: string;
  evs: Record<string, number>;
  moves: string[];
  role: string;
  style: SetStyle;
  confidence: number;
  source: string;
  notes: string[];
}

export interface MetaContextSummary {
  format: string;
  sourceName: string;
  sourceConfidence: number;
  keyThreats: string[];
  archetypes: string[];
  pressureSummary: string;
  warnings: string[];
}

export interface GamePlanSummary {
  likelyLead: string;
  primaryWinCondition: string;
  secondaryWinCondition: string;
  defensivePlan: string;
  offensivePlan: string;
  pivotPlan: string;
  biggestRisk: string;
  pilotingGuide: string;
}

export interface MatchupScore {
  archetype: string;
  score: number;
  level: MatchupLevel;
  notes: string[];
}

export interface MatchupValidationSummary {
  scores: MatchupScore[];
  worstMatchup: string;
  stabilityLabel: MatchupLevel;
  riskNotes: string[];
}

export interface EquinoxBalanceDimensions {
  competitivePower: number;
  formatFit: number;
  coreSynergy: number;
  setQuality: number;
  gamePlanClarity: number;
  matchupStability: number;
  riskControl: number;
  creativityViability: number;
  identityAlignment: number;
}

export interface EquinoxBalanceReport {
  score: number;
  level: BalanceLevel;
  dimensions: EquinoxBalanceDimensions;
  summary: string;
  warnings: string[];
}
