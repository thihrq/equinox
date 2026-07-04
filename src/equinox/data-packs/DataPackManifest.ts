import { EquinoxDataSourceStatus } from '../data/DataSourceReport';

export type EquinoxDataPackKind =
  | 'vanilla_pool'
  | 'boss_gauntlet'
  | 'regulation_profile'
  | 'eligible_roster'
  | 'meta_profile';

export type EquinoxDataPackGameFamily =
  | 'core'
  | 'smogon'
  | 'radical_red'
  | 'pokemon_champions';

export type EquinoxDataPackRefreshCadence =
  | 'release_locked'
  | 'on_patch'
  | 'seasonal'
  | 'manual';

export type EquinoxDataPackValidationStatus = 'pass' | 'warn' | 'fail';

export interface EquinoxDataPackValidationResult {
  status: EquinoxDataPackValidationStatus;
  errors: string[];
  warnings: string[];
}

export interface EquinoxDataPackManifest {
  id: string;
  kind: EquinoxDataPackKind;
  title: string;
  gameFamily: EquinoxDataPackGameFamily;
  formatIds: string[];
  dataVersion: string;
  status: EquinoxDataSourceStatus;
  sourceName: string;
  sourceUrl?: string;
  sourceUpdatedAt?: string;
  dataHash?: string;
  recordCount: number;
  refreshCadence: EquinoxDataPackRefreshCadence;
  owner: string;
  notes: string[];
  validation: EquinoxDataPackValidationResult;
}

export interface EquinoxDataPackReport {
  generatedAt: string;
  overallStatus: EquinoxDataSourceStatus;
  confidence: number;
  totalPacks: number;
  packsByKind: Record<EquinoxDataPackKind, number>;
  manifests: EquinoxDataPackManifest[];
  failingPacks: string[];
  warnings: string[];
  updateActions: string[];
}
