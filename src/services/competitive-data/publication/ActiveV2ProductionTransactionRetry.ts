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
 * repetindo automaticamente quando o erro carrega o rótulo
 * `TransientTransactionError` — sessão nova, transação nova, mesma
 * operação. Não retenta nenhum outro tipo de erro (esses continuam
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

      if (hasErrorLabel(error, 'TransientTransactionError') && attempt < maxRetries) {
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
