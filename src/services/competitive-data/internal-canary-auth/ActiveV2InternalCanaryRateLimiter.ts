import mongoose from 'mongoose';
import { ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1, type ActiveV2InternalCanaryAuthPolicy } from './ActiveV2InternalCanaryAuthPolicy';

/**
 * Rate limit por subject, contador compartilhado no Mongo (mesma razão do
 * nonce store: múltiplas instâncias do Render não podem contar
 * independentemente). Implementado como um contador por "bucket" de tempo
 * fixo (`rateLimitWindowMs`) — simples e suficiente como defesa em
 * profundidade; não é o controle de segurança primário (esse é a
 * assinatura + allowlist), então uma pequena janela de corrida entre o
 * incremento e a leitura é aceitável.
 */
export async function tryConsumeActiveV2CanaryRateLimit(
  connection: mongoose.Connection,
  subject: string,
  now: Date = new Date(),
  policy: ActiveV2InternalCanaryAuthPolicy = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1
): Promise<boolean> {
  const db = connection.db;
  if (!db) {
    throw new Error('CANARY_RATE_LIMIT_FAILED: MongoDB connection db is not initialized');
  }

  const col = db.collection<any>(policy.rateLimitCollectionName);
  const bucketStart = Math.floor(now.getTime() / policy.rateLimitWindowMs) * policy.rateLimitWindowMs;
  const bucketId = `${subject}:${bucketStart}`;

  try {
    await col.updateOne(
      { _id: bucketId } as any,
      { $inc: { count: 1 }, $setOnInsert: { subject, bucketStart } },
      { upsert: true }
    );
  } catch (error) {
    throw new Error(`CANARY_RATE_LIMIT_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  let doc: any;
  try {
    doc = await col.findOne({ _id: bucketId } as any);
  } catch (error) {
    throw new Error(`CANARY_RATE_LIMIT_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }

  const count = doc?.count ?? 1;
  return count <= policy.rateLimitMaxRequestsPerSubject;
}
