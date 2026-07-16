import mongoose from 'mongoose';
import { ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1, type ActiveV2InternalCanaryAuthPolicy } from './ActiveV2InternalCanaryAuthPolicy';
import { loadActiveV2InternalCanaryAllowlist, isActiveV2CanarySubjectAllowlisted } from './ActiveV2InternalCanaryAllowlist';
import { loadActiveV2InternalCanarySecrets, findActiveActiveV2CanarySecretsAt } from './ActiveV2InternalCanarySecretRegistry';
import { verifyActiveV2InternalCanarySignature } from './ActiveV2InternalCanarySignature';
import { tryConsumeActiveV2CanaryNonce } from './ActiveV2InternalCanaryNonceStore';
import { tryConsumeActiveV2CanaryRateLimit } from './ActiveV2InternalCanaryRateLimiter';
import type {
  ActiveV2InternalCanaryRequestHeaders,
  ActiveV2InternalCanaryValidationResult,
} from './ActiveV2InternalCanaryAuthTypes';

function denied(
  subject: string | null,
  reason: NonNullable<ActiveV2InternalCanaryValidationResult['denialReason']>,
  validatedAt: string
): ActiveV2InternalCanaryValidationResult {
  return { authorized: false, subject, denialReason: reason, validatedAt };
}

/**
 * Executa, em ordem, as seis validações do adendo 3.5:
 *   1. timestamp dentro da janela permitida
 *   2. subject em allowlist
 *   3. segredo ativo e não expirado
 *   4. assinatura válida
 *   5. nonce ainda não utilizado (store compartilhado)
 *   6. rate limit específico (store compartilhado)
 *
 * A ordem é deliberada: checagens baratas e sem estado (timestamp,
 * allowlist, assinatura) vêm antes das que tocam o Mongo compartilhado
 * (nonce, rate limit) — uma requisição mal assinada nunca chega a consumir
 * um nonce ou contar contra o rate limit de ninguém.
 */
export async function validateActiveV2InternalCanaryRequest(
  connection: mongoose.Connection,
  headers: Partial<ActiveV2InternalCanaryRequestHeaders>,
  requestPath: string,
  now: Date = new Date(),
  policy: ActiveV2InternalCanaryAuthPolicy = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1,
  env: NodeJS.ProcessEnv = process.env
): Promise<ActiveV2InternalCanaryValidationResult> {
  const validatedAt = now.toISOString();

  if (!headers.subject || !headers.timestamp || !headers.nonce || !headers.signature) {
    return denied(headers.subject ?? null, 'MISSING_HEADERS', validatedAt);
  }

  const { subject, timestamp, nonce, signature } = headers;

  // 1. timestamp dentro da janela permitida
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(now.getTime() - timestampMs) > policy.timestampWindowMs) {
    return denied(subject, 'TIMESTAMP_OUT_OF_WINDOW', validatedAt);
  }

  // 2. subject em allowlist
  const allowlist = loadActiveV2InternalCanaryAllowlist(env);
  if (!isActiveV2CanarySubjectAllowlisted(subject, allowlist)) {
    return denied(subject, 'SUBJECT_NOT_ALLOWLISTED', validatedAt);
  }

  // 3 + 4. segredo ativo e assinatura válida
  const secrets = loadActiveV2InternalCanarySecrets(env);
  const activeSecrets = findActiveActiveV2CanarySecretsAt(secrets, now);
  if (activeSecrets.length === 0) {
    return denied(subject, 'NO_ACTIVE_SECRET', validatedAt);
  }

  const signatureValid = activeSecrets.some(activeSecret =>
    verifyActiveV2InternalCanarySignature(signature, subject, timestamp, nonce, requestPath, activeSecret.secret)
  );
  if (!signatureValid) {
    return denied(subject, 'INVALID_SIGNATURE', validatedAt);
  }

  // 5. nonce ainda não utilizado
  const nonceFresh = await tryConsumeActiveV2CanaryNonce(connection, subject, nonce, now, policy);
  if (!nonceFresh) {
    return denied(subject, 'NONCE_ALREADY_USED', validatedAt);
  }

  // 6. rate limit específico
  const withinRateLimit = await tryConsumeActiveV2CanaryRateLimit(connection, subject, now, policy);
  if (!withinRateLimit) {
    return denied(subject, 'RATE_LIMIT_EXCEEDED', validatedAt);
  }

  return { authorized: true, subject, denialReason: null, validatedAt };
}
