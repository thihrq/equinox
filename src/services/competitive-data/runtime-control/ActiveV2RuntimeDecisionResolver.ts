import { isActiveV2CanarySelected } from './ActiveV2CanarySelector';
import type { ActiveV2RuntimeControl } from './ActiveV2RuntimeControlTypes';
import type { ActiveV2CanaryConfig } from './ActiveV2CanaryConfigTypes';

export type ActiveV2ServePath = 'active-v2' | 'baseline';

export interface ActiveV2RuntimeDecisionInput {
  circuitBreaker: ActiveV2RuntimeControl;
  /** process.env.EQUINOX_ACTIVE_V2_FORCE_BASELINE === 'true', resolvido pelo chamador. */
  staticForceBaseline: boolean;
  canaryConfig: ActiveV2CanaryConfig;
  /** Identificador estável usado no hashing do seletor de canário (ex: teamIdentity/session hash). */
  identifier: string;
  /** Resultado da validação HMAC da Fase 5 — false por padrão enquanto essa fase não existe. */
  isAuthorizedInternalCanaryRequest: boolean;
  /** Uma tentativa anterior de V2 nesta mesma requisição já falhou/expirou. */
  perRequestFallbackRequested: boolean;
}

export interface ActiveV2RuntimeDecision {
  servePath: ActiveV2ServePath;
  /** true quando mode='shadow': baseline responde ao usuário, mas o V2 ainda deve rodar em paralelo (Fase 3). */
  shadowParallelEvaluation: boolean;
  reasonCode: string;
}

function resolveWithPerRequestFallback(
  input: ActiveV2RuntimeDecisionInput,
  selectedReasonCode: string
): ActiveV2RuntimeDecision {
  if (input.perRequestFallbackRequested) {
    return { servePath: 'baseline', shadowParallelEvaluation: false, reasonCode: 'PER_REQUEST_FALLBACK' };
  }
  return { servePath: 'active-v2', shadowParallelEvaluation: false, reasonCode: selectedReasonCode };
}

/**
 * Implementa a regra de precedência revisada do adendo 3.2:
 *
 *   circuit breaker dinâmico
 *   → FORCE_BASELINE estático
 *   → modo operacional
 *   → seleção canária
 *   → fallback por requisição
 *
 * Função pura — não lê nem escreve nada; todos os insumos (estado do
 * breaker, config de canário, flags) já devem ter sido lidos pelo chamador.
 * Ainda não está ligada a nenhum caminho de requisição real — não há
 * runtime V2 recebendo tráfego público hoje (ver limitação no sumário desta
 * fase). Este resolver é o contrato que o runtime deve consumir quando essa
 * integração existir.
 */
export function resolveActiveV2RuntimeDecision(input: ActiveV2RuntimeDecisionInput): ActiveV2RuntimeDecision {
  // 1. circuit breaker dinâmico
  if (input.circuitBreaker.mode === 'force-baseline') {
    return { servePath: 'baseline', shadowParallelEvaluation: false, reasonCode: 'CIRCUIT_BREAKER_FORCE_BASELINE' };
  }

  // 2. FORCE_BASELINE estático
  if (input.staticForceBaseline) {
    return { servePath: 'baseline', shadowParallelEvaluation: false, reasonCode: 'STATIC_FORCE_BASELINE' };
  }

  // 3. modo operacional
  const { mode } = input.canaryConfig;

  if (mode === 'off') {
    return { servePath: 'baseline', shadowParallelEvaluation: false, reasonCode: 'MODE_OFF' };
  }

  if (mode === 'shadow') {
    return { servePath: 'baseline', shadowParallelEvaluation: true, reasonCode: 'MODE_SHADOW' };
  }

  if (mode === 'internal') {
    if (!input.isAuthorizedInternalCanaryRequest) {
      return { servePath: 'baseline', shadowParallelEvaluation: false, reasonCode: 'MODE_INTERNAL_UNAUTHORIZED' };
    }
    return resolveWithPerRequestFallback(input, 'MODE_INTERNAL_AUTHORIZED');
  }

  if (mode === 'full') {
    return resolveWithPerRequestFallback(input, 'MODE_FULL');
  }

  // 4. seleção canária (mode === 'percentage')
  if (input.canaryConfig.percentage === null) {
    return { servePath: 'baseline', shadowParallelEvaluation: false, reasonCode: 'MODE_PERCENTAGE_MISCONFIGURED' };
  }

  const selected = isActiveV2CanarySelected(input.identifier, input.canaryConfig.seed, input.canaryConfig.percentage);
  if (!selected) {
    return { servePath: 'baseline', shadowParallelEvaluation: false, reasonCode: 'CANARY_NOT_SELECTED' };
  }

  // 5. fallback por requisição
  return resolveWithPerRequestFallback(input, 'CANARY_SELECTED');
}
