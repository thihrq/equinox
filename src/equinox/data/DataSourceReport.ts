export type EquinoxDataSourceCategory =
  | 'format'
  | 'vanilla_pool'
  | 'boss_gauntlet'
  | 'regulation'
  | 'roster'
  | 'meta';

export type EquinoxDataSourceStatus =
  | 'verified'
  | 'community'
  | 'bootstrap'
  | 'pending'
  | 'outdated'
  | 'unknown';

export type EquinoxDataSourceSeverity = 'ok' | 'notice' | 'warning' | 'critical';

export interface EquinoxDataSourceEntry {
  id: string;
  title: string;
  category: EquinoxDataSourceCategory;
  status: EquinoxDataSourceStatus;
  severity: EquinoxDataSourceSeverity;
  version?: string;
  scope: string;
  sourceName: string;
  sourceUrl?: string;
  sourceUpdatedAt?: string;
  dataHash?: string;
  notes: string[];
  warnings: string[];
  refreshPolicy: string;
}

export interface EquinoxDataSourceReport {
  overallStatus: EquinoxDataSourceStatus;
  confidence: number;
  entries: EquinoxDataSourceEntry[];
  criticalWarnings: string[];
  updateChecklist: string[];
  generatedAt: string;
}
