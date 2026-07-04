export type ChampionsBattleStyle = 'singles' | 'doubles';
export type ChampionsMode = 'ranked' | 'casual' | 'private';
export type ChampionsRegulationStatus = 'verified' | 'community' | 'outdated' | 'unknown';
export type ChampionsMetaSourceStatus = 'verified' | 'community' | 'bootstrap' | 'pending' | 'outdated' | 'unknown';
export type ChampionsMetaSourceReliability = 'official' | 'tournament_derived' | 'community' | 'bootstrap';
export type ChampionsRegulationLevel = 'Excellent' | 'Strong' | 'Playable' | 'Fragile' | 'Unsafe';
export type ChampionsThreatCategory = 'Physical' | 'Special' | 'Mixed' | 'Utility';

export interface ChampionsRegulationThreat {
  name: string;
  types: string[];
  category: ChampionsThreatCategory;
  baseSpeed: number;
  importance: number;
  tags: string[];
}

export interface ChampionsMetaSourceSummary {
  id: string;
  label: string;
  sourceName: string;
  sourceUrl?: string;
  reliability: ChampionsMetaSourceReliability;
  status: ChampionsMetaSourceStatus;
  scope: string;
}

export interface ChampionsMetaArchetypeSummary {
  id: string;
  label: string;
  battleStyle: ChampionsBattleStyle;
  reliability: ChampionsMetaSourceReliability;
  priority: number;
  corePokemon: string[];
  supportPokemon: string[];
  tags: string[];
}

export interface ChampionsRegulationWeights {
  speedControl: number;
  roleCompression: number;
  threatCoverage: number;
  fieldControl: number;
  megaReadiness: number;
  consistency: number;
}

export interface ChampionsRegulationProfile {
  id: string;
  regulationSet: string;
  label: string;
  shortLabel: string;
  battleStyle: ChampionsBattleStyle;
  mode: ChampionsMode;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  dataVersion: string;
  dataStatus: ChampionsRegulationStatus;
  rosterStatus: 'official_summary' | 'community_curated' | 'pending_full_import';
  sourceName: string;
  sourceUrl: string;
  secondarySourceName?: string;
  secondarySourceUrl?: string;
  metaSourcePackId?: string;
  metaSourcePackLabel?: string;
  metaSourceStatus?: ChampionsMetaSourceStatus;
  metaSourceConfidence?: number;
  sourceBreakdown?: ChampionsMetaSourceSummary[];
  metaArchetypes?: ChampionsMetaArchetypeSummary[];
  megaEvolutionAllowed: boolean;
  teamPreviewSize: number;
  selectedForBattle: number;
  keyThreats: ChampionsRegulationThreat[];
  rolePriorities: string[];
  notes: string[];
  warnings: string[];
  uiTags: string[];
  weights: ChampionsRegulationWeights;
}

export interface ChampionsRoleCoverage {
  speedControl: number;
  roleCompression: number;
  threatCoverage: number;
  fieldControl: number;
  megaReadiness: number;
  consistency: number;
}

export interface ChampionsThreatAnswer {
  threat: ChampionsRegulationThreat;
  bestAnswer?: string;
  score: number;
  confidence: number;
  level: ChampionsRegulationLevel;
  reasons: string[];
  warnings: string[];
}

export interface ChampionsRegulationAnalysis {
  profileId: string;
  regulationSet: string;
  label: string;
  battleStyle: ChampionsBattleStyle;
  mode: ChampionsMode;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  dataVersion: string;
  dataStatus: ChampionsRegulationStatus;
  rosterStatus: ChampionsRegulationProfile['rosterStatus'];
  sourceName: string;
  sourceUrl: string;
  secondarySourceName?: string;
  secondarySourceUrl?: string;
  metaSourcePackId?: string;
  metaSourcePackLabel?: string;
  metaSourceStatus?: ChampionsMetaSourceStatus;
  metaSourceConfidence?: number;
  sourceBreakdown?: ChampionsMetaSourceSummary[];
  metaArchetypes?: ChampionsMetaArchetypeSummary[];
  megaEvolutionAllowed: boolean;
  teamPreviewSize: number;
  selectedForBattle: number;
  score: number;
  confidence: number;
  level: ChampionsRegulationLevel;
  roleCoverage: ChampionsRoleCoverage;
  threatAnswers: ChampionsThreatAnswer[];
  keyThreats: ChampionsRegulationThreat[];
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  notes: string[];
  warnings: string[];
  uiTags: string[];
}

export interface ChampionsCandidateFit {
  score: number;
  reasons: string[];
}
