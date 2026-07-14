import { MongoClient } from 'mongodb';
import { ActiveStagingConfigError } from './ActiveStagingHomologationConfig';
import {
  ACTIVE_STAGING_CONFIG_EXIT_CODE,
  ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE,
  ACTIVE_STAGING_MONGO_READ_EXIT_CODE,
  type FunctionalHomologationExitCode,
} from './ActiveStagingHomologationTypes';

export class ActiveStagingRepositoryFunctionalGateError extends Error {}

export function assertUniqueActiveStagingSetIds(setIds: string[]): void {
  if (new Set(setIds).size !== setIds.length) {
    throw new ActiveStagingRepositoryFunctionalGateError('duplicate active staging setIds returned by repository');
  }
}

export function createActiveStagingMongoClient(mongoUri: string): MongoClient {
  try {
    return new MongoClient(mongoUri, { monitorCommands: true });
  } catch {
    throw new ActiveStagingConfigError('MONGO_URI or MONGODB_URI must be a valid MongoDB connection URI');
  }
}

export function assertActiveStagingRepositoryFunctionalGates(
  recordsFound: number,
  expectedRecords: number,
  observedMongoWriteCommands: number,
  commandMonitorProductionCollectionReads: number,
  collectionMonitorProductionCollectionReads: number,
): void {
  if (recordsFound !== expectedRecords) {
    throw new ActiveStagingRepositoryFunctionalGateError(`expected ${expectedRecords} active allowlisted records`);
  }
  if (observedMongoWriteCommands !== 0) {
    throw new ActiveStagingRepositoryFunctionalGateError('write commands must be zero');
  }
  if (commandMonitorProductionCollectionReads !== 0 || collectionMonitorProductionCollectionReads !== 0) {
    throw new ActiveStagingRepositoryFunctionalGateError('production reads must be zero');
  }
}

export function activeStagingRepositoryExitCodeFor(error: unknown): FunctionalHomologationExitCode {
  if (error instanceof ActiveStagingConfigError) return ACTIVE_STAGING_CONFIG_EXIT_CODE;
  if (error instanceof ActiveStagingRepositoryFunctionalGateError) return ACTIVE_STAGING_FUNCTIONAL_GATE_EXIT_CODE;
  return ACTIVE_STAGING_MONGO_READ_EXIT_CODE;
}
