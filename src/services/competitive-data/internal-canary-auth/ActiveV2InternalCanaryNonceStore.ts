import mongoose from 'mongoose';
import { ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1 } from './ActiveV2InternalCanaryAuthPolicy';

/**
 * Armazenamento compartilhado de nonces (refinamento 8.1 do adendo): o mesmo
 * argumento usado contra memória local no circuit breaker (3.2) vale aqui —
 * se cada instância do Render guardasse nonces em memória local, uma
 * requisição repetida poderia ser aceita por uma instância diferente da que
 * já a processou. Usa o Mongo compartilhado, com `_id` determinístico
 * (`subject:nonce`) para que a própria restrição de unicidade do banco
 * detecte replay de forma atômica — não há janela de corrida entre
 * "verificar se já existe" e "inserir", porque é uma única operação.
 */
export async function tryConsumeActiveV2CanaryNonce(
  connection: mongoose.Connection,
  subject: string,
  nonce: string,
  now: Date = new Date(),
  policy = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1
): Promise<boolean> {
  const db = connection.db;
  if (!db) {
    throw new Error('CANARY_NONCE_STORE_FAILED: MongoDB connection db is not initialized');
  }

  const col = db.collection<any>(policy.nonceCollectionName);
  const nonceKey = `${subject}:${nonce}`;

  try {
    await col.insertOne({
      _id: nonceKey,
      subject,
      nonce,
      consumedAt: now,
    } as any);
    return true;
  } catch (error: any) {
    if (error?.code === 11000) {
      // chave duplicada -> este nonce já foi consumido (replay)
      return false;
    }
    throw new Error(`CANARY_NONCE_STORE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verifica se a coleção de nonces tem o índice TTL esperado em `consumedAt`
 * (limpeza automática — nonces só precisam sobreviver pela janela de
 * tolerância de timestamp, nunca mais que isso). Mesmo padrão de
 * `verifyProductionIndexesAndDuplicities`: recebe a conexão, lança com
 * prefixo padronizado se o índice estiver ausente.
 */
export async function verifyActiveV2CanaryNonceStoreIndexes(
  connection: mongoose.Connection,
  policy = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1
): Promise<void> {
  const db = connection.db;
  if (!db) {
    throw new Error('CANARY_NONCE_INDEX_PREFLIGHT_FAILED: MongoDB connection db is not initialized');
  }

  const col = db.collection(policy.nonceCollectionName);

  let indexes: any[] = [];
  try {
    indexes = await col.listIndexes().toArray();
  } catch (error) {
    throw new Error(`CANARY_NONCE_INDEX_PREFLIGHT_FAILED: Failed to list indexes for ${policy.nonceCollectionName}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const hasTtlIndex = indexes.some(idx => idx.key?.consumedAt === 1 && typeof idx.expireAfterSeconds === 'number');

  if (!hasTtlIndex) {
    throw new Error(
      `CANARY_NONCE_INDEX_PREFLIGHT_FAILED: TTL index on ${policy.nonceCollectionName}.consumedAt is missing (create with expireAfterSeconds >= timestampWindowMs/1000)`
    );
  }
}
