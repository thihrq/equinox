import type { ActiveV2InternalCanaryValidationResult } from './ActiveV2InternalCanaryAuthTypes';

/**
 * Registra o identificador interno (subject) e o resultado da validação —
 * exatamente o que o adendo 3.5 exige. Deliberadamente NÃO registra IP por
 * padrão: "IP deve seguir a política de privacidade/retenção da
 * instituição" (adendo 3.5), então captura de IP é opt-in explícito do
 * chamador (`ipAddress`), nunca automática.
 */
export function printActiveV2InternalCanaryAuditEntry(
  result: ActiveV2InternalCanaryValidationResult,
  requestPath: string,
  ipAddress?: string
): void {
  console.log(
    `[CANARY AUTH] subject=${result.subject ?? 'unknown'} path=${requestPath} authorized=${result.authorized} reason=${result.denialReason ?? 'n/a'} at=${result.validatedAt}`
  );
  if (ipAddress) {
    console.log(`[CANARY AUTH IP] ${ipAddress}`);
  }
}
