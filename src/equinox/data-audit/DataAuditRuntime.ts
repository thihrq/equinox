import { resolveDataMode, EquinoxDataMode } from '../../config/dataMode';
import { assertDatabaseWritesAllowed as assertConfiguredDatabaseWritesAllowed } from '../../config/databaseWriteGuard';

export { resolveDataMode };

export interface AuditSourceReport {
  type: 'file' | 'mongo' | 'memory';
  path?: string;
  label: string;
  recordCount: number;
  contentHash?: string;
}

export interface AuditRuntimeReport {
  dataMode: EquinoxDataMode;
  sources: AuditSourceReport[];
  mongo: {
    connected: boolean;
    reads: number;
    writes: number;
  };
}

const mongoCounters = {
  connected: false,
  reads: 0,
  writes: 0,
};

export function assertMongoAccessAllowed(operation: string): void {
  if (resolveDataMode() === 'filesystem') {
    throw new Error(`MongoDB access is forbidden while EQUINOX_DATA_MODE=filesystem. Operation: ${operation}.`);
  }
}

export function assertDatabaseWritesAllowed(operation: string): void {
  assertConfiguredDatabaseWritesAllowed({ operation });
}

export function markMongoConnected(): void {
  mongoCounters.connected = true;
}

export function markMongoRead(count = 1): void {
  mongoCounters.reads += count;
}

export function markMongoWrite(count = 1): void {
  mongoCounters.writes += count;
}

export function resetAuditRuntimeCounters(): void {
  mongoCounters.connected = false;
  mongoCounters.reads = 0;
  mongoCounters.writes = 0;
}

export function buildAuditRuntimeReport(sources: AuditSourceReport[] = []): AuditRuntimeReport {
  return {
    dataMode: resolveDataMode(),
    sources,
    mongo: { ...mongoCounters },
  };
}

export function printAuditRuntimeReport(report: AuditRuntimeReport): void {
  console.log(`[DATA MODE] ${report.dataMode}`);
  for (const source of report.sources) {
    console.log(`[SOURCE] ${source.label} (${source.type}) records=${source.recordCount}${source.path ? ` path=${source.path}` : ''}`);
  }
  console.log(`[MONGO] ${report.mongo.connected ? 'connected' : 'disabled'}`);
  console.log(`[READS] local=${report.sources.reduce((sum, source) => sum + source.recordCount, 0)} mongo=${report.mongo.reads}`);
  console.log(`[WRITES] ${report.mongo.writes}`);
}

export function stableContentHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
