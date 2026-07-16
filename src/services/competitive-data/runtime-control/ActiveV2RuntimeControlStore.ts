import mongoose from 'mongoose';
import {
  ACTIVE_V2_RUNTIME_CONTROL_DEFAULT_STATE,
  type ActiveV2RuntimeControl,
} from './ActiveV2RuntimeControlTypes';
import { ACTIVE_V2_RUNTIME_CONTROL_POLICY_V1 } from './ActiveV2RuntimeControlPolicy';
import { assertActiveV2CircuitBreakerWriteRoleAllowed } from './ActiveV2RuntimeControlWriteGuard';

const SINGLETON_ID = 'active-v2-runtime-control';

/**
 * Lê o estado dinâmico atual do circuit breaker. Se nenhum documento existir
 * ainda (primeira execução do sistema), retorna o estado padrão seguro
 * (`normal`, sem necessidade de recuperação manual).
 */
export async function readActiveV2RuntimeControl(connection: mongoose.Connection): Promise<ActiveV2RuntimeControl> {
  const db = connection.db;
  if (!db) {
    throw new Error('CIRCUIT_BREAKER_READ_FAILED: MongoDB connection db is not initialized');
  }

  const col = db.collection<any>(ACTIVE_V2_RUNTIME_CONTROL_POLICY_V1.collectionName);

  let doc: any;
  try {
    doc = await col.findOne({ _id: SINGLETON_ID } as any);
  } catch (error) {
    throw new Error(`CIRCUIT_BREAKER_READ_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!doc) {
    return { ...ACTIVE_V2_RUNTIME_CONTROL_DEFAULT_STATE };
  }

  return {
    mode: doc.mode,
    reasonCode: doc.reasonCode ?? null,
    triggeredBy: doc.triggeredBy ?? null,
    triggeredAt: doc.triggeredAt ?? null,
    metricsWindowId: doc.metricsWindowId ?? null,
    requiresManualRecovery: !!doc.requiresManualRecovery,
    version: doc.version ?? 0,
  };
}

/**
 * Escreve um novo estado do circuit breaker usando concorrência otimista:
 * a escrita só é aplicada se `expectedCurrentVersion` ainda for o valor
 * corrente no banco (ou se for a primeira escrita, version=0, via upsert).
 * Isso evita que dois escritores concorrentes (ex: dois monitores automáticos)
 * pisem um no estado do outro silenciosamente.
 *
 * Exige a role de escrita dedicada — ver `ActiveV2RuntimeControlWriteGuard.ts`.
 */
export async function writeActiveV2RuntimeControl(
  connection: mongoose.Connection,
  expectedCurrentVersion: number,
  nextState: Omit<ActiveV2RuntimeControl, 'version'>
): Promise<ActiveV2RuntimeControl> {
  assertActiveV2CircuitBreakerWriteRoleAllowed({ operation: 'writeActiveV2RuntimeControl' });

  const db = connection.db;
  if (!db) {
    throw new Error('CIRCUIT_BREAKER_WRITE_FAILED: MongoDB connection db is not initialized');
  }

  const col = db.collection<any>(ACTIVE_V2_RUNTIME_CONTROL_POLICY_V1.collectionName);
  const newVersion = expectedCurrentVersion + 1;
  const updatedDoc: ActiveV2RuntimeControl = { ...nextState, version: newVersion };

  let updateResult: any;
  try {
    updateResult = await col.updateOne(
      { _id: SINGLETON_ID, version: expectedCurrentVersion } as any,
      { $set: updatedDoc },
      { upsert: expectedCurrentVersion === 0 }
    );
  } catch (error) {
    throw new Error(`CIRCUIT_BREAKER_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  const applied =
    (updateResult.matchedCount ?? 0) > 0 ||
    (updateResult.upsertedCount ?? 0) > 0 ||
    updateResult.upsertedId != null;

  if (!applied) {
    throw new Error(
      `CIRCUIT_BREAKER_WRITE_CONFLICT: expected version ${expectedCurrentVersion} was stale; another writer changed the state concurrently. Re-read and retry.`
    );
  }

  return updatedDoc;
}
