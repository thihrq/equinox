export type FormatIntelligenceMode =
  | 'generic_balance'
  | 'meta_ladder'
  | 'boss_gauntlet'
  | 'live_regulation';

export type FormatDataStatus =
  | 'verified'
  | 'community'
  | 'outdated'
  | 'unknown';

export type FormatBattleStyle = 'generic' | 'singles' | 'doubles' | 'gauntlet';

export type FormatGameFamily =
  | 'core'
  | 'smogon'
  | 'radical_red'
  | 'pokemon_champions';

export interface FormatIntelligenceWeights {
  balance: number;
  meta: number;
  boss: number;
  regulation: number;
  defense: number;
  speed: number;
  roles: number;
  threats: number;
  consistency: number;
  worstMatchup: number;
}

export interface FormatIntelligenceProfile {
  id: string;
  label: string;
  gameFamily: FormatGameFamily;
  mode: FormatIntelligenceMode;
  battleStyle: FormatBattleStyle;
  engineStrategy: string;
  description: string;
  sourceName: string;
  sourceUrl?: string;
  sourceUpdatedAt?: string;
  dataVersion: string;
  dataStatus: FormatDataStatus;
  fallbackFormat: 'vanilla' | 'radical_red' | 'national_dex';
  usesMeta: boolean;
  usesBossData: boolean;
  usesRegulationData: boolean;
  warning?: string;
  uiTags: string[];
  weights: FormatIntelligenceWeights;
}

export interface FormatIntelligenceAnalysis extends FormatIntelligenceProfile {
  normalizedFrom: string;
  isScenarioAware: boolean;
  freshnessLabel: string;
}
