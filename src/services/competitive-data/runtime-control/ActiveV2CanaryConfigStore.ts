import mongoose from 'mongoose';
import {
  ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE,
  type ActiveV2CanaryConfig,
} from './ActiveV2CanaryConfigTypes';
import { assertActiveV2CanaryConfigWriteRoleAllowed } from './ActiveV2CanaryConfigWriteGuard';

const COLLECTION_NAME = 'active-v2-canary-config';
const SINGLETON_ID = 'active-v2-canary-config';

export async function readActiveV2CanaryConfig(connection: mongoose.Connection): Promise<ActiveV2CanaryConfig> {
  const db = connection.db;
  if (!db) {
    throw new Error('CANARY_CONFIG_READ_FAILED: MongoDB connection db is not initialized');
  }

  const col = db.collection<any>(COLLECTION_NAME);

  let doc: any;
  try {
    doc = await col.findOne({ _id: SINGLETON_ID } as any);
  } catch (error) {
    throw new Error(`CANARY_CONFIG_READ_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!doc) {
    return { ...ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE };
  }

  return {
    mode: doc.mode,
    percentage: doc.percentage ?? null,
    canaryCampaignId: doc.canaryCampaignId,
    seed: doc.seed,
    windowStartedAt: doc.windowStartedAt,
    windowEndedAt: doc.windowEndedAt ?? null,
    version: doc.version ?? 0,
  };
}

/**
 * Escreve uma nova configuração de canário com concorrência otimista (mesmo
 * padrão do circuit breaker) e a única regra de imutabilidade exigida pelo
 * adendo 4.1: a seed não pode mudar sem que uma nova campanha formal
 * (`canaryCampaignId` novo) também seja registrada.
 */
export async function writeActiveV2CanaryConfig(
  connection: mongoose.Connection,
  current: ActiveV2CanaryConfig,
  nextState: Omit<ActiveV2CanaryConfig, 'version'>
): Promise<ActiveV2CanaryConfig> {
  assertActiveV2CanaryConfigWriteRoleAllowed({ operation: 'writeActiveV2CanaryConfig' });

  if (nextState.seed !== current.seed && nextState.canaryCampaignId === current.canaryCampaignId) {
    throw new Error(
      'SEED_CHANGE_REQUIRES_NEW_CAMPAIGN: a seed só pode mudar junto com um novo canaryCampaignId (adendo 4.1).'
    );
  }

  const db = connection.db;
  if (!db) {
    throw new Error('CANARY_CONFIG_WRITE_FAILED: MongoDB connection db is not initialized');
  }

  const col = db.collection<any>(COLLECTION_NAME);
  const newVersion = current.version + 1;
  const updatedDoc: ActiveV2CanaryConfig = { ...nextState, version: newVersion };

  let updateResult: any;
  try {
    updateResult = await col.updateOne(
      { _id: SINGLETON_ID, version: current.version } as any,
      { $set: updatedDoc },
      { upsert: current.version === 0 }
    );
  } catch (error) {
    throw new Error(`CANARY_CONFIG_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  const applied =
    (updateResult.matchedCount ?? 0) > 0 ||
    (updateResult.upsertedCount ?? 0) > 0 ||
    updateResult.upsertedId != null;

  if (!applied) {
    throw new Error(
      `CANARY_CONFIG_WRITE_CONFLICT: expected version ${current.version} was stale; another writer changed the config concurrently. Re-read and retry.`
    );
  }

  return updatedDoc;
}
