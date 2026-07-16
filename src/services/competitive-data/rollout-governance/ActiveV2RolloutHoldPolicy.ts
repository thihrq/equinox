export interface ActiveV2RolloutHoldPolicy {
  version: string;
  maxHoldDurationDays: number;
}

/**
 * Teto de `hold` por falta de volume (adendo 4.3, refinamento 8.5). Uma fase
 * de rollout em `hold` por insuficiência de amostra não pode ficar pendente
 * indefinidamente — ao atingir este teto, a decisão de prosseguir, ajustar o
 * piso de volume ou encerrar a fase exige revisão humana explícita e registrada.
 */
export const ACTIVE_V2_ROLLOUT_HOLD_POLICY_V1: ActiveV2RolloutHoldPolicy = {
  version: 'active-v2-rollout-hold-v1',
  maxHoldDurationDays: 21,
} as const;

export interface RolloutHoldExpiryCheck {
  holdStartedAt: string;
  elapsedDays: number;
  maxHoldDurationDays: number;
  expired: boolean;
}

/**
 * Verifica se um `hold` de fase de rollout já ultrapassou o teto de dias
 * corridos. Não decide sozinho o que fazer a seguir — apenas sinaliza que a
 * fase precisa de revisão humana explícita (a decisão em si é sempre manual).
 */
export function checkActiveV2RolloutHoldExpiry(
  holdStartedAt: string,
  now: Date = new Date(),
  policy: ActiveV2RolloutHoldPolicy = ACTIVE_V2_ROLLOUT_HOLD_POLICY_V1
): RolloutHoldExpiryCheck {
  const startedAtMs = Date.parse(holdStartedAt);
  const elapsedDays = (now.getTime() - startedAtMs) / (1000 * 60 * 60 * 24);

  return {
    holdStartedAt,
    elapsedDays,
    maxHoldDurationDays: policy.maxHoldDurationDays,
    expired: elapsedDays >= policy.maxHoldDurationDays,
  };
}
