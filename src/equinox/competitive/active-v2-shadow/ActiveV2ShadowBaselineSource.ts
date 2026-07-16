import { createHash } from 'crypto';
import pilotPack from '../../data-packs/competitive/champions-reg-mb-doubles/sets.json';
import type { ActiveStagingSetRecord } from '../active-staging/ActiveStagingHomologationTypes';
import type { ActiveV2ShadowBaselineMetadata } from './ActiveV2ShadowTypes';

export const CONTROLLED_BASELINE_SOURCE_VERSION = 'champions-reg-mb-doubles-baseline-v1';

export interface ControlledBaselineSource {
  records: ActiveStagingSetRecord[];
  metadata: ActiveV2ShadowBaselineMetadata;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type ControlledBaselinePackRecord = Omit<Partial<ActiveStagingSetRecord>, 'status' | 'active'> & {
  setId: string;
  status: string;
  active?: boolean;
  pokemon?: string;
  pokemonName?: string;
};

export function loadControlledBaselineRecords(): ActiveStagingSetRecord[] {
  return (pilotPack.sets as unknown as ControlledBaselinePackRecord[])
    .filter(record => record.status === 'reviewed' || record.status === 'verified' || record.status === 'active')
    .map(record => ({
      ...record,
      pokemon: record.pokemonName ?? record.pokemon,
      format: 'champions-reg-mb-doubles',
    }) as ActiveStagingSetRecord)
    .sort((a, b) => compareText(String(a.setId), String(b.setId)));
}

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalizeValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('controlled baseline contains a non-finite number');
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => canonicalizeValue(item));
  if (typeof value === 'object') {
    const canonical: { [key: string]: CanonicalValue } = {};
    for (const key of Object.keys(value).sort(compareText)) {
      const fieldValue = (value as Record<string, unknown>)[key];
      if (fieldValue !== undefined) canonical[key] = canonicalizeValue(fieldValue);
    }
    return canonical;
  }
  throw new Error(`controlled baseline contains unsupported value type: ${typeof value}`);
}

export function canonicalizeBaselineSource(records: ActiveStagingSetRecord[]): string {
  const canonical = records
    .map(record => ({
      setId: String(record.setId),
      value: canonicalizeValue(record),
    }))
    .sort((a, b) => compareText(a.setId, b.setId) || compareText(JSON.stringify(a.value), JSON.stringify(b.value)))
    .map(record => record.value);
  return JSON.stringify(canonical);
}

export function computeBaselineSourceDigest(records: ActiveStagingSetRecord[]): `sha256-${string}` {
  const digest = createHash('sha256').update(canonicalizeBaselineSource(records), 'utf8').digest('hex');
  return `sha256-${digest}`;
}

export function readControlledBaselineSource(): ControlledBaselineSource {
  const records = loadControlledBaselineRecords();
  return {
    records,
    metadata: {
      baselineSourceVersion: CONTROLLED_BASELINE_SOURCE_VERSION,
      baselineSourceDigest: computeBaselineSourceDigest(records),
      baselineSourceRecordCount: records.length,
    },
  };
}
