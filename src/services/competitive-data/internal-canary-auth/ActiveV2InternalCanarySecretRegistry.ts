import type { ActiveV2InternalCanarySecret } from './ActiveV2InternalCanaryAuthTypes';

const ENV_VAR_NAME = 'EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS';

/**
 * Segredos de HMAC deliberadamente NÃO ficam no Mongo (ao contrário do nonce
 * store e do rate limiter, que precisam ser compartilhados entre instâncias
 * por razão de correção, não de sigilo). Material de segredo fica em
 * variável de ambiente — em produção real, isso deve vir de um secrets
 * manager (Render secret files, Atlas não é o lugar certo para isso).
 *
 * Formato esperado (JSON):
 * [{"secretId":"v1","secret":"...","activeFrom":"2026-07-01T00:00:00.000Z","activeUntil":null}]
 *
 * Múltiplos segredos podem estar ativos simultaneamente para permitir
 * rotação sem downtime (o validador aceita a assinatura se QUALQUER segredo
 * ativo no momento validar).
 */
export function loadActiveV2InternalCanarySecrets(env: NodeJS.ProcessEnv = process.env): ActiveV2InternalCanarySecret[] {
  const raw = env[ENV_VAR_NAME];
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`CANARY_HMAC_SECRETS_INVALID: ${ENV_VAR_NAME} não é um JSON válido`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`CANARY_HMAC_SECRETS_INVALID: ${ENV_VAR_NAME} deve ser um array`);
  }

  return parsed.map((entry, index) => {
    if (
      typeof entry !== 'object' || entry === null ||
      typeof (entry as any).secretId !== 'string' ||
      typeof (entry as any).secret !== 'string' ||
      typeof (entry as any).activeFrom !== 'string'
    ) {
      throw new Error(`CANARY_HMAC_SECRETS_INVALID: entrada[${index}] malformada (secretId/secret/activeFrom obrigatórios)`);
    }
    const activeUntil = (entry as any).activeUntil;
    if (activeUntil !== null && activeUntil !== undefined && typeof activeUntil !== 'string') {
      throw new Error(`CANARY_HMAC_SECRETS_INVALID: entrada[${index}].activeUntil deve ser string ou null`);
    }
    return {
      secretId: (entry as any).secretId,
      secret: (entry as any).secret,
      activeFrom: (entry as any).activeFrom,
      activeUntil: activeUntil ?? null,
    };
  });
}

/** Filtra os segredos ativos no instante `at` (activeFrom <= at <= activeUntil, ou sem expiração). */
export function findActiveActiveV2CanarySecretsAt(
  secrets: readonly ActiveV2InternalCanarySecret[],
  at: Date = new Date()
): ActiveV2InternalCanarySecret[] {
  const atMs = at.getTime();
  return secrets.filter(secret => {
    const fromMs = Date.parse(secret.activeFrom);
    const untilMs = secret.activeUntil ? Date.parse(secret.activeUntil) : Infinity;
    return atMs >= fromMs && atMs <= untilMs;
  });
}
