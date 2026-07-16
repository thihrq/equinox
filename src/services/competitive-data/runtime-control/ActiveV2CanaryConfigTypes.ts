export type ActiveV2CanaryMode = 'off' | 'shadow' | 'internal' | 'percentage' | 'full';

/**
 * Configuração operacional do canário (Fase 4). Distinta do estado do circuit
 * breaker (`ActiveV2RuntimeControl`) — este documento descreve a *intenção*
 * de rollout (qual modo, qual percentual, qual seed), enquanto o breaker
 * descreve uma condição de emergência que pode sobrepor essa intenção.
 */
export interface ActiveV2CanaryConfig {
  mode: ActiveV2CanaryMode;
  /** Só relevante quando mode === 'percentage'. 0-100. */
  percentage: number | null;
  canaryCampaignId: string;
  seed: string;
  windowStartedAt: string;
  windowEndedAt: string | null;
  version: number;
}

export const ACTIVE_V2_CANARY_CONFIG_DEFAULT_STATE: ActiveV2CanaryConfig = {
  mode: 'off',
  percentage: null,
  canaryCampaignId: 'unstarted',
  seed: 'unstarted',
  windowStartedAt: new Date(0).toISOString(),
  windowEndedAt: null,
  version: 0,
};

export interface ActiveV2CanaryModeTransitionRequest {
  targetMode: ActiveV2CanaryMode;
  targetPercentage: number | null;
  /** Necessário apenas quando a seed precisa mudar (nova campanha formal). */
  newCanaryCampaignId?: string;
  newSeed?: string;
}
