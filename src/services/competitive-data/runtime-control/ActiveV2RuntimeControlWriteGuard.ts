export interface ActiveV2RuntimeControlWriteContext {
  operation: string;
}

/**
 * Restringe a escrita do estado do circuit breaker (adendo 3.2, refinamento 8.4).
 * Deliberadamente uma flag DISTINTA de `EQUINOX_ALLOW_DATABASE_WRITES` — possuir
 * permissão geral de escrita na aplicação não é suficiente para gravar o estado
 * do breaker. Isso evita que a credencial geral da aplicação vire um vetor de
 * ataque capaz de forçar baseline indevidamente ou suprimir `requiresManualRecovery`.
 *
 * Aproximação de camada de software: em produção real, esta flag deve estar
 * amarrada a uma credencial/role dedicada do Atlas (usuário de banco distinto
 * da aplicação geral), não apenas a uma variável de ambiente do processo —
 * isso depende de provisionamento real do cluster, fora do escopo deste código.
 */
export function assertActiveV2CircuitBreakerWriteRoleAllowed(context: ActiveV2RuntimeControlWriteContext): void {
  const roleAllowed = process.env.EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE === 'true';

  if (!roleAllowed) {
    throw new Error(
      `CIRCUIT_BREAKER_WRITE_FORBIDDEN: ${context.operation}. Set EQUINOX_ACTIVE_V2_CIRCUIT_BREAKER_WRITE_ROLE=true explicitly (role dedicada, distinta de EQUINOX_ALLOW_DATABASE_WRITES).`
    );
  }
}
