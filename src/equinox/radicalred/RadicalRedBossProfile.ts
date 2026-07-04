import { ThreatCategory } from '../threats/Threat';

export type RadicalRedBossStage = 'elite_four' | 'champion';
export type RadicalRedBossMode = 'normal' | 'hardcore';
export type RadicalRedBossLevel = 'Dominant' | 'Favorable' | 'Playable' | 'Risky' | 'Dangerous';
export type RadicalRedDataStatus = 'verified' | 'community' | 'outdated' | 'unknown';

export interface RadicalRedBossPokemon {
  name: string;
  types: string[];
  category: ThreatCategory;
  baseSpeed: number;
  importance: number;
  ability?: string;
  item?: string;
  moves?: string[];
  tags: string[];
}

export interface RadicalRedBossVariant {
  id: string;
  label: string;
  trigger?: string;
  battleEffect?: string;
  pokemon: RadicalRedBossPokemon[];
}

export interface RadicalRedBossBattle {
  id: string;
  name: string;
  stage: RadicalRedBossStage;
  order: number;
  notes: string[];
  requiredAnswers: string[];
  variants: RadicalRedBossVariant[];
}

export interface RadicalRedDataPack {
  id: string;
  game: 'radicalred';
  version: string;
  mode: RadicalRedBossMode;
  label: string;
  sourceName: string;
  sourceUrl: string;
  sourceUpdatedAt: string;
  dataVersion: string;
  dataStatus: RadicalRedDataStatus;
  dataHash: string;
  warnings: string[];
  bosses: RadicalRedBossBattle[];
}

export interface RadicalRedThreatAnswer {
  pokemon: string;
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  reasons: string[];
  warnings: string[];
}

export interface RadicalRedThreatReport {
  threat: RadicalRedBossPokemon;
  bestAnswer: RadicalRedThreatAnswer;
  alternativeAnswers: RadicalRedThreatAnswer[];
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  reasons: string[];
  warnings: string[];
}

export interface RadicalRedBossVariantReport {
  id: string;
  label: string;
  trigger?: string;
  battleEffect?: string;
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  criticalThreats: RadicalRedThreatReport[];
  bestCoveredThreats: RadicalRedThreatReport[];
  worstThreat?: RadicalRedThreatReport;
  threatReports: RadicalRedThreatReport[];
}

export interface RadicalRedBossReport {
  id: string;
  name: string;
  stage: RadicalRedBossStage;
  order: number;
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  notes: string[];
  requiredAnswers: string[];
  worstVariant: RadicalRedBossVariantReport;
  variants: RadicalRedBossVariantReport[];
}

export interface RadicalRedGauntletAnalysis {
  profileId: string;
  label: string;
  version: string;
  mode: RadicalRedBossMode;
  dataStatus: RadicalRedDataStatus;
  dataVersion: string;
  sourceName: string;
  sourceUpdatedAt: string;
  dataHash: string;
  averageBossScore: number;
  worstBossScore: number;
  consistencyScore: number;
  confidence: number;
  level: RadicalRedBossLevel;
  worstBoss?: RadicalRedBossReport;
  bossReports: RadicalRedBossReport[];
  criticalThreats: RadicalRedThreatReport[];
  requiredActions: string[];
  warnings: string[];
}
