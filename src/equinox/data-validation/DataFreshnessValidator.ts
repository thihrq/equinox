import { CompetitiveDataSourceType } from '../data-sources/DataSourceCatalog';

export type FreshnessStatus = 'current' | 'aging' | 'stale' | 'unknown';

export interface DataFreshnessResult {
  status: FreshnessStatus;
  ageDays?: number;
  confidenceMultiplier: number;
  warning?: string;
}

const maxAgeDays: Partial<Record<CompetitiveDataSourceType, number>> = {
  official: 120,
  'usage-stats': 30,
  tournament: 60,
  community: 90,
  curated: 120,
};

export function validateDataFreshness(input: {
  sourceType: CompetitiveDataSourceType;
  sourceUpdatedAt?: string | Date;
  now?: Date;
}): DataFreshnessResult {
  if (input.sourceType === 'generated' || input.sourceType === 'fallback') {
    return { status: 'unknown', confidenceMultiplier: 0.7, warning: 'Generated/fallback data has no freshness claim.' };
  }
  if (!input.sourceUpdatedAt) {
    return { status: 'unknown', confidenceMultiplier: 0.75, warning: 'Missing real source update date.' };
  }

  const now = input.now ?? new Date();
  const updated = new Date(input.sourceUpdatedAt);
  const ageDays = Math.floor((now.getTime() - updated.getTime()) / 86_400_000);
  const maxAge = maxAgeDays[input.sourceType] ?? 90;

  if (ageDays <= Math.floor(maxAge * 0.7)) return { status: 'current', ageDays, confidenceMultiplier: 1 };
  if (ageDays <= maxAge) return { status: 'aging', ageDays, confidenceMultiplier: 0.9 };
  return { status: 'stale', ageDays, confidenceMultiplier: 0.6, warning: 'Source is stale for its cadence.' };
}
