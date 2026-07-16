import type { MongoClient } from 'mongodb';
import { MongoCommandMonitor } from '../active-staging/ActiveStagingMongoCommandMonitor';
import { CollectionReadMonitor } from '../active-staging/ActiveStagingCollectionReadMonitor';
import {
  ActiveStagingRepositoryFunctionalGateError,
  createActiveStagingMongoClient,
} from '../active-staging/ActiveStagingRepositoryValidation';
import { assertActiveV2ShadowConfig, ActiveV2ShadowConfigError, readActiveV2ShadowConfig } from './ActiveV2ShadowConfig';
import { readControlledBaselineSource } from './ActiveV2ShadowBaselineSource';
import { loadActiveV2ShadowRecords } from './ActiveV2ShadowMongoRead';
import { runActiveV2ShadowComparison } from './ActiveV2ShadowRunner';
import { assertActiveV2ShadowGates, ActiveV2ShadowGateError } from './ActiveV2ShadowGates';
import {
  ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE,
  ACTIVE_V2_SHADOW_GATE_EXIT_CODE,
  ACTIVE_V2_SHADOW_MONGO_EXIT_CODE,
  type ActiveV2ShadowExitCode,
  type ActiveV2ShadowReport,
} from './ActiveV2ShadowTypes';

function requireMongoUri(env: NodeJS.ProcessEnv): string {
  const uri = env.MONGO_URI ?? env.MONGODB_URI;
  if (!uri) throw new ActiveV2ShadowConfigError('MONGO_URI or MONGODB_URI is required');
  return uri;
}

function attachCommandMonitor(client: MongoClient, monitor: MongoCommandMonitor): void {
  client.on('commandStarted', event => {
    const collectionName = event.command[event.commandName];
    monitor.record({
      commandName: event.commandName,
      collectionName: typeof collectionName === 'string' ? collectionName : undefined,
    });
  });
}

export function sanitizeActiveV2ShadowCliMessage(message: string): string {
  return message.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1[REDACTED]@');
}

export function serializeActiveV2ShadowReport(report: ActiveV2ShadowReport): string {
  return JSON.stringify(report, null, 2);
}

export function activeV2ShadowExitCodeFor(error: unknown): ActiveV2ShadowExitCode {
  if (error instanceof ActiveV2ShadowConfigError) return ACTIVE_V2_SHADOW_CONFIG_EXIT_CODE;
  if (error instanceof ActiveV2ShadowGateError || error instanceof ActiveStagingRepositoryFunctionalGateError) {
    return ACTIVE_V2_SHADOW_GATE_EXIT_CODE;
  }
  return ACTIVE_V2_SHADOW_MONGO_EXIT_CODE;
}

export async function closeActiveV2ShadowCliClient(
  client: Pick<MongoClient, 'close'> | undefined,
  exitCode: ActiveV2ShadowExitCode,
): Promise<ActiveV2ShadowExitCode> {
  if (!client) return exitCode;

  try {
    await client.close();
    return exitCode;
  } catch (error) {
    console.error(sanitizeActiveV2ShadowCliMessage(error instanceof Error ? error.message : String(error)));
    return exitCode === 0 ? ACTIVE_V2_SHADOW_MONGO_EXIT_CODE : exitCode;
  }
}

export async function runActiveV2ShadowCli(env: NodeJS.ProcessEnv = process.env): Promise<ActiveV2ShadowExitCode> {
  let client: MongoClient | undefined;
  let exitCode: ActiveV2ShadowExitCode = 0;
  try {
    const config = assertActiveV2ShadowConfig(readActiveV2ShadowConfig(env));
    const commandMonitor = new MongoCommandMonitor();
    const readMonitor = new CollectionReadMonitor();
    client = createActiveStagingMongoClient(requireMongoUri(env));
    attachCommandMonitor(client, commandMonitor);
    await client.connect();

    const baseline = readControlledBaselineSource();
    const activeV2Records = await loadActiveV2ShadowRecords({ client, config, commandMonitor, readMonitor });
    const commandReport = commandMonitor.report();
    const readReport = readMonitor.report();
    const report = runActiveV2ShadowComparison({
      baselineRecords: baseline.records,
      activeV2Records,
      baselineMetadata: baseline.metadata,
      productionCollectionReads: commandReport.productionCollectionReads + readReport.productionCollectionReads,
      observedMongoWriteCommands: commandReport.observedMongoWriteCommands,
      observedStagingWriteCommands: commandReport.observedStagingWriteCommands,
      observedProductionWriteCommands: commandReport.observedProductionWriteCommands,
      recordsWritten: commandReport.observedMongoWriteCommands,
      productionWrites: commandReport.observedProductionWriteCommands,
    });
    assertActiveV2ShadowGates(report);
    console.log(serializeActiveV2ShadowReport(report));
  } catch (error) {
    console.error(sanitizeActiveV2ShadowCliMessage(error instanceof Error ? error.message : String(error)));
    exitCode = activeV2ShadowExitCodeFor(error);
  }

  return closeActiveV2ShadowCliClient(client, exitCode);
}
