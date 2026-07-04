import { Threat } from '../threats/Threat';

export type MatchupLevel = 'Dominant' | 'Favorable' | 'Playable' | 'Risky' | 'Dangerous';

export interface PokemonMatchupAnswer {
  pokemon: string;
  score: number;
  confidence: number;
  level: MatchupLevel;
  reasons: string[];
  warnings: string[];
  defensiveScore: number;
  offensivePressure: number;
  speedAdvantage: number;
  roleCompatibility: number;
  riskPenalty: number;
}

export interface DamageMatchupReport {
  threat: Threat;
  bestAnswer: PokemonMatchupAnswer;
  alternativeAnswers: PokemonMatchupAnswer[];
  matchupScore: number;
  confidence: number;
  level: MatchupLevel;
  reasons: string[];
  warnings: string[];
}

export interface DamageReport {
  averageMatchupScore: number;
  averageConfidence: number;
  dominantMatchups: DamageMatchupReport[];
  favorableMatchups: DamageMatchupReport[];
  playableMatchups: DamageMatchupReport[];
  riskyMatchups: DamageMatchupReport[];
  dangerousMatchups: DamageMatchupReport[];
  matchups: DamageMatchupReport[];
}
