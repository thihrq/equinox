import mongoose from 'mongoose';

/**
 * Máximo de tentativas para uma transação que falha com `TransientTransactionError`
 * — o rótulo oficial do MongoDB para erros que a própria driver/servidor
 * espera que o chamador tente de novo automaticamente, não que um humano
 * reexecute o comando manualmente (documentado em
 * https://www.mongodb.com/docs/manual/core/transactions-in-applications/#retry-transactions).
 * Observado na prática em clusters Atlas M0/Flex: a checagem interna de quota
 * de armazenamento que o Atlas roda antes de aceitar uma transação pode dar
 * timeout de forma transitória mesmo com uso de disco muito abaixo do limite.
 */
export const MAX_TRANSIENT_TRANSACTION_RETRIES = 5;
export const TRANSIENT_TRANSACTION_RETRY_DELAY_MS = 500;

export function hasErrorLabel(error: unknown, label: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { hasErrorLabel?: unknown }).hasErrorLabel === 'function' &&
    (error as { hasErrorLabel: (label: string) => boolean }).hasErrorLabel(label)
  );
}

/**
 * Erro específico observado em clusters Atlas M0/Flex: a checagem interna
 * de quota de armazenamento que o Atlas roda antes de aceitar uma transação
 * pode dar timeout de forma transitória — confirmado empiricamente contra o
 * cluster real desta sessão (4 falhas consecutivas com esta mensagem exata,
 * uso de disco em ~1.2MB de um limite de 512MB, uma transação mínima de 1
 * operação bem-sucedida logo em seguida, e nenhuma escrita parcial em
 * nenhuma tentativa). Esta mensagem NÃO carrega o rótulo padrão
 * `TransientTransactionError` do MongoDB — é um erro injetado pela camada
 * de proxy do Atlas para tiers compartilhados/gratuitos, não pelo mongod em
 * si — por isso precisa de uma checagem própria além de `hasErrorLabel`.
 */
const ATLAS_TRANSIENT_QUOTA_CHECK_ERROR_PATTERN = /space quota.*dbStats.*MaxTimeMSExpired/is;

export function isKnownAtlasTransientQuotaCheckError(error: unknown): boolean {
  return error instanceof Error && ATLAS_TRANSIENT_QUOTA_CHECK_ERROR_PATTERN.test(error.message);
}

function isRetryableTransactionError(error: unknown): boolean {
  return hasErrorLabel(error, 'TransientTransactionError') || isKnownAtlasTransientQuotaCheckError(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface TransactionRetryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, maxRetries: number, error: unknown) => void;
}

/**
 * Executa `body` dentro de uma transação MongoDB nova a cada tentativa,
 * repetindo automaticamente quando o erro é reconhecidamente retentável
 * (rótulo `TransientTransactionError` do MongoDB, ou o erro de checagem de
 * quota transitória específico do Atlas M0/Flex — ver
 * `isKnownAtlasTransientQuotaCheckError`) — sessão nova, transação nova,
 * mesma operação. Não retenta nenhum outro tipo de erro (esses continuam
 * abortando e propagando na primeira falha, como antes).
 */
export async function runInTransactionWithRetry<T>(
  connection: mongoose.Connection,
  body: (session: mongoose.mongo.ClientSession) => Promise<T>,
  options: TransactionRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_TRANSIENT_TRANSACTION_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? TRANSIENT_TRANSACTION_RETRY_DELAY_MS;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = await connection.startSession();
    session.startTransaction();

    try {
      const result = await body(session);
      await session.commitTransaction();
      session.endSession();
      return result;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();

      if (isRetryableTransactionError(error) && attempt < maxRetries) {
        lastError = error;
        options.onRetry?.(attempt, maxRetries, error);
        await sleep(retryDelayMs * attempt);
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
