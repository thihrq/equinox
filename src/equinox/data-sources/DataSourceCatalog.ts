export type CompetitiveDataSourceType =
  | 'official'
  | 'tournament'
  | 'usage-stats'
  | 'community'
  | 'curated'
  | 'generated'
  | 'fallback';

export interface CompetitiveDataSourceDefinition {
  id: string;
  name: string;
  type: CompetitiveDataSourceType;
  gameFamily: string;
  battleStyle: 'singles' | 'doubles' | 'both';
  formatIds: string[];
  regulationIds: string[];
  sourceUrl?: string;
  collectedAt?: string;
  sourceUpdatedAt?: string;
  refreshCadence: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'manual';
  trustScore: number;
  enabled: boolean;
}

export const DATA_SOURCE_TRUST = {
  official: 100,
  officialTournament: 96,
  curatedVerified: 92,
  currentUsageStats: 85,
  communityTournament: 80,
  communityUsage: 72,
  generatedPreset: 50,
  fallback: 30,
} as const;

export const COMPETITIVE_DATA_SOURCES: CompetitiveDataSourceDefinition[] = [
  {
    id: 'equinox-legacy-sets-pack',
    name: 'Equinox legacy sets-data-pack.json',
    type: 'fallback',
    gameFamily: 'mixed',
    battleStyle: 'both',
    formatIds: ['vanilla', 'radical_red', 'champions_reg_m_b_doubles'],
    regulationIds: ['legacy_unclassified'],
    refreshCadence: 'manual',
    trustScore: DATA_SOURCE_TRUST.fallback,
    enabled: true,
  },
  {
    id: 'equinox-curated-champions-mb-doubles',
    name: 'Equinox Curated Champions Regulation M-B Doubles',
    type: 'curated',
    gameFamily: 'pokemon_champions',
    battleStyle: 'doubles',
    formatIds: ['champions_reg_m_b_doubles'],
    regulationIds: ['champions_reg_m_b_doubles'],
    collectedAt: '2026-07-12',
    sourceUpdatedAt: '2026-07-12',
    refreshCadence: 'seasonal',
    trustScore: DATA_SOURCE_TRUST.curatedVerified,
    enabled: true,
  },
  {
    id: 'pkmn-dex-structural-reference',
    name: '@pkmn/dex structural reference',
    type: 'official',
    gameFamily: 'pokemon',
    battleStyle: 'both',
    formatIds: ['all'],
    regulationIds: ['all'],
    refreshCadence: 'manual',
    trustScore: DATA_SOURCE_TRUST.official,
    enabled: true,
  },
];

export function getCompetitiveDataSources(): CompetitiveDataSourceDefinition[] {
  return COMPETITIVE_DATA_SOURCES.filter(source => source.enabled);
}

export function getCompetitiveDataSource(sourceId: string): CompetitiveDataSourceDefinition | undefined {
  return getCompetitiveDataSources().find(source => source.id === sourceId);
}
