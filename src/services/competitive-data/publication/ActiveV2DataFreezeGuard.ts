import type { ActiveV2CanaryConfig, ActiveV2CanaryMode } from '../runtime-control/ActiveV2CanaryConfigTypes';

/**
 * Modos de canário que representam uma janela de observação ativa (adendo
 * seção 13 "Congelamento de dados"). 'off' e 'full' não têm janela de
 * observação em andamento (full é o estado terminal pós-rollout) e 'shadow'
 * não afeta tráfego real de usuários, então não são congelados aqui —
 * embora 'shadow' também tenha um critério próprio de tempo/volume (Fase 3),
 * ele não decide qual conteúdo os usuários reais recebem, então uma nova
 * publicação durante o shadow não compromete a leitura de nenhum canário
 * público em andamento.
 */
const FROZEN_CANARY_MODES: ReadonlySet<ActiveV2CanaryMode> = new Set(['internal', 'percentage']);

export interface ActiveV2DataFreezeOverride {
  emergencyOverride: boolean;
  emergencyJustification: string | null;
}

export const ACTIVE_V2_DATA_FREEZE_NO_OVERRIDE: ActiveV2DataFreezeOverride = {
  emergencyOverride: false,
  emergencyJustification: null,
};

export interface ActiveV2DataFreezeCheck {
  freezeActive: boolean;
  overridden: boolean;
  canaryPhaseLabel: string;
}

function describePhase(canaryConfig: Pick<ActiveV2CanaryConfig, 'mode' | 'percentage'>): string {
  return canaryConfig.percentage !== null ? `${canaryConfig.mode}:${canaryConfig.percentage}` : canaryConfig.mode;
}

/**
 * Impede uma nova publicação (`publishRunId`) enquanto uma janela canária
 * pública ou interna estiver em observação — publicar um novo lote nesse
 * meio-tempo invalidaria a comparação em andamento sem que ninguém tivesse
 * decidido isso deliberadamente. Não é uma trava absoluta: uma publicação
 * emergencial pode prosseguir com `emergencyOverride` + justificativa
 * explícita, mas isso não substitui o processo manual completo descrito no
 * adendo (forçar baseline, invalidar a janela, homologar o novo lote,
 * reiniciar a observação) — o guard só impede o acidente de publicar sem
 * ninguém perceber que uma janela estava ativa.
 */
export function assertActiveV2DataFreezeAllowsPublication(
  canaryConfig: Pick<ActiveV2CanaryConfig, 'mode' | 'percentage'>,
  override: ActiveV2DataFreezeOverride = ACTIVE_V2_DATA_FREEZE_NO_OVERRIDE
): ActiveV2DataFreezeCheck {
  const canaryPhaseLabel = describePhase(canaryConfig);
  const freezeActive = FROZEN_CANARY_MODES.has(canaryConfig.mode);

  if (!freezeActive) {
    return { freezeActive: false, overridden: false, canaryPhaseLabel };
  }

  const hasValidJustification = override.emergencyJustification !== null && override.emergencyJustification.trim().length > 0;
  if (override.emergencyOverride && hasValidJustification) {
    return { freezeActive: true, overridden: true, canaryPhaseLabel };
  }

  throw new Error(
    `DATA_FREEZE_ACTIVE: publicacao bloqueada durante janela canaria ativa (fase "${canaryPhaseLabel}", adendo secao 13 ` +
      `"Congelamento de dados"). Publicacao emergencial exige emergencyOverride=true e uma emergencyJustification nao vazia, ` +
      `e nao dispensa o processo manual completo: 1) forcar baseline, 2) invalidar a janela de observacao atual, ` +
      `3) homologar o novo lote, 4) reiniciar a observacao apos publicar.`
  );
}
