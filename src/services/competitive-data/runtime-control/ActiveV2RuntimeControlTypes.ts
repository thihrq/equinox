export type ActiveV2RuntimeControlMode = 'normal' | 'force-baseline';

export type ActiveV2RuntimeControlTriggerSource = 'automatic' | 'manual';

/**
 * Estado operacional dinâmico do circuit breaker (adendo 3.2), consultado pelo
 * runtime a cada requisição — distinto da configuração estática de deploy
 * (`EQUINOX_ACTIVE_V2_FORCE_BASELINE`). Persistido em uma coleção Mongo
 * dedicada (`active-v2-runtime-control`), nunca em memória local de instância.
 */
export interface ActiveV2RuntimeControl {
  mode: ActiveV2RuntimeControlMode;
  reasonCode: string | null;
  triggeredBy: ActiveV2RuntimeControlTriggerSource | null;
  triggeredAt: string | null;
  metricsWindowId: string | null;
  requiresManualRecovery: boolean;
  version: number;
}

export const ACTIVE_V2_RUNTIME_CONTROL_DEFAULT_STATE: ActiveV2RuntimeControl = {
  mode: 'normal',
  reasonCode: null,
  triggeredBy: null,
  triggeredAt: null,
  metricsWindowId: null,
  requiresManualRecovery: false,
  version: 0,
};

/**
 * Entrada do changelog versionado obrigatório (adendo 4.2). Um registro por
 * mudança de estado do breaker (trip automático/manual ou reativação) OU por
 * mudança de modo/percentual/seed do canário (Fase 4) — ambos compartilham o
 * mesmo arquivo de changelog, daí `valorAnterior`/`valorNovo` serem `string`
 * livre (ex: "normal", "force-baseline", "percentage:10", "full").
 */
export interface ActiveV2RuntimeControlChangelogEntry {
  timestampUtc: string;
  responsavel: string;
  aprovador: string | null;
  valorAnterior: string;
  valorNovo: string;
  motivo: string;
  canaryCampaignId: string | null;
  publishRunId: string | null;
  resultado: 'success' | 'rejected';
}
