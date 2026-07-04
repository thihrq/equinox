export type ThreatCategory = 'Physical' | 'Special' | 'Mixed';
export type ThreatLevel = 'Safe' | 'Good' | 'Neutral' | 'Dangerous' | 'Critical';

export interface Threat {
  name: string;
  importance: number;
  types: string[];
  category: ThreatCategory;
  baseSpeed: number;
  tags: string[];
}

export interface ThreatMatchup {
  threat: Threat;
  score: number;
  level: ThreatLevel;
  answers: string[];
  problems: string[];
}

export interface ThreatAnalysis {
  averageScore: number;
  safeThreats: ThreatMatchup[];
  goodThreats: ThreatMatchup[];
  neutralThreats: ThreatMatchup[];
  dangerousThreats: ThreatMatchup[];
  criticalThreats: ThreatMatchup[];
  matchups: ThreatMatchup[];
}
