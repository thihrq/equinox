export interface ActiveV2CanaryConfigWriteContext {
  operation: string;
}

/**
 * Restringe a escrita da configuração de canário (modo/percentual/seed) a uma
 * flag dedicada, pela mesma razão do write guard do circuit breaker: a
 * configuração de canário decide quem recebe tráfego público do Active V2,
 * então a credencial geral da aplicação não deve, sozinha, poder alterá-la.
 */
export function assertActiveV2CanaryConfigWriteRoleAllowed(context: ActiveV2CanaryConfigWriteContext): void {
  const roleAllowed = process.env.EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE === 'true';

  if (!roleAllowed) {
    throw new Error(
      `CANARY_CONFIG_WRITE_FORBIDDEN: ${context.operation}. Set EQUINOX_ACTIVE_V2_CANARY_CONFIG_WRITE_ROLE=true explicitly (role dedicada, distinta de EQUINOX_ALLOW_DATABASE_WRITES).`
    );
  }
}
