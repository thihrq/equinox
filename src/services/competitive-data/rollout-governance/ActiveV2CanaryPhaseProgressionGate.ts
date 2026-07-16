import type { ActiveV2RuntimeControlMode } from '../runtime-control/ActiveV2RuntimeControlTypes';
import type { ActiveV2RuntimeAlert, ActiveV2RuntimeMetricsSnapshot } from '../runtime-observability/ActiveV2RuntimeTelemetryTypes';
import { getActiveV2CanaryPhaseCriteria, type ActiveV2CanaryPhaseKey } from './ActiveV2CanaryPhaseProgressionPolicy';
import { checkActiveV2RolloutHoldExpiry, ACTIVE_V2_ROLLOUT_HOLD_POLICY_V1 } from './ActiveV2RolloutHoldPolicy';

export type ActiveV2CanaryPhaseProgressionDecision = 'advance' | 'rollback' | 'hold';

export interface ActiveV2CanaryPhaseProgressionInput {
  currentPhase: ActiveV2CanaryPhaseKey;
  /** `ActiveV2CanaryConfig.windowStartedAt` — início real da fase, não da janela de agregação de métricas. */
  phaseWindowStartedAt: string;
  metrics: ActiveV2RuntimeMetricsSnapshot;
  alerts: readonly ActiveV2RuntimeAlert[];
  circuitBreakerMode: ActiveV2RuntimeControlMode;
  now?: Date;
}

export interface ActiveV2CanaryPhaseProgressionResult {
  decision: ActiveV2CanaryPhaseProgressionDecision;
  currentPhase: ActiveV2CanaryPhaseKey;
  phaseLabel: string;
  elapsedObservationDays: number;
  minObservationDays: number;
  validExecutions: number;
  minValidExecutions: number;
  daysCriterionMet: boolean;
  volumeCriterionMet: boolean;
  circuitBreakerTripped: boolean;
  criticalAlertCodes: string[];
  holdExpired: boolean;
  maxHoldDurationDays: number;
  nextPhase: ActiveV2CanaryPhaseKey | null;
  reasons: string[];
}

/**
 * Decide se uma fase de rollout progressivo (Fases 3, 5-10) deve avançar,
 * voltar (rollback) ou permanecer em observação (`hold`) — o terceiro estado
 * de gate exigido pela seção 13 do adendo original, que os Acceptance Gates
 * (aprovado/rejeitado/revisão humana) não cobrem porque avaliam qualidade de
 * dados, não progresso de uma janela de tráfego real ao longo do tempo.
 *
 * Função pura — não lê nem escreve nada, não decide sozinha em produção: o
 * resultado é uma recomendação para o operador humano, que ainda precisa
 * executar a transição real via `setActiveV2CanaryMode`/
 * `ActiveV2CanaryTransitionPolicy` (com o controle de quatro olhos aplicável
 * ao percentual de destino).
 *
 * Precedência: circuit breaker disparado ou alerta crítico presente na
 * janela sempre resultam em `rollback`, mesmo que os critérios de
 * tempo/volume já tenham sido atingidos — segurança tem prioridade sobre
 * progressão. Só na ausência desses dois sinais é que os critérios de
 * tempo+volume decidem entre `advance` e `hold`.
 */
export function evaluateActiveV2CanaryPhaseProgression(
  input: ActiveV2CanaryPhaseProgressionInput
): ActiveV2CanaryPhaseProgressionResult {
  const { currentPhase, phaseWindowStartedAt, metrics, alerts, circuitBreakerMode } = input;
  const now = input.now ?? new Date();

  const criteria = getActiveV2CanaryPhaseCriteria(currentPhase);
  if (!criteria) {
    const label = currentPhase.percentage === null ? currentPhase.mode : `${currentPhase.mode}:${currentPhase.percentage}`;
    throw new Error(
      `PHASE_NOT_OBSERVABLE: a fase "${label}" nao possui janela de observacao de tempo/volume definida no adendo (ex: modo "off"). Nada a progredir.`
    );
  }

  const startedAtMs = Date.parse(phaseWindowStartedAt);
  if (Number.isNaN(startedAtMs)) {
    throw new Error(`PHASE_WINDOW_INVALID: phaseWindowStartedAt "${phaseWindowStartedAt}" nao e uma data ISO valida.`);
  }

  const elapsedObservationDays = (now.getTime() - startedAtMs) / (1000 * 60 * 60 * 24);
  const validExecutions = metrics.v2.successCount;
  const daysCriterionMet = elapsedObservationDays >= criteria.minObservationDays;
  const volumeCriterionMet = validExecutions >= criteria.minValidExecutions;

  const criticalAlertCodes = alerts.filter(a => a.severity === 'critical').map(a => a.code);
  const circuitBreakerTripped = circuitBreakerMode === 'force-baseline';

  const holdExpiry = checkActiveV2RolloutHoldExpiry(phaseWindowStartedAt, now, ACTIVE_V2_ROLLOUT_HOLD_POLICY_V1);

  const reasons: string[] = [];
  let decision: ActiveV2CanaryPhaseProgressionDecision;

  if (circuitBreakerTripped) {
    decision = 'rollback';
    reasons.push('Circuit breaker em modo force-baseline: rollback obrigatorio antes de qualquer progressao.');
  } else if (criticalAlertCodes.length > 0) {
    decision = 'rollback';
    reasons.push(`Alerta(s) critico(s) presente(s) na janela: ${criticalAlertCodes.join(', ')}.`);
  } else if (daysCriterionMet && volumeCriterionMet) {
    decision = 'advance';
    reasons.push(
      `Criterios atingidos: ${elapsedObservationDays.toFixed(1)}/${criteria.minObservationDays} dias e ${validExecutions}/${criteria.minValidExecutions} execucoes validas.`
    );
  } else {
    decision = 'hold';
    if (!daysCriterionMet) {
      reasons.push(`Janela de observacao insuficiente: ${elapsedObservationDays.toFixed(1)}/${criteria.minObservationDays} dias.`);
    }
    if (!volumeCriterionMet) {
      reasons.push(`Volume de execucoes validas insuficiente: ${validExecutions}/${criteria.minValidExecutions}.`);
    }
    if (holdExpiry.expired) {
      reasons.push(
        `Hold ultrapassou o teto de ${holdExpiry.maxHoldDurationDays} dias (adendo 4.3) — exige revisao humana explicita, nao deve permanecer em espera automatica indefinidamente.`
      );
    }
  }

  return {
    decision,
    currentPhase,
    phaseLabel: criteria.phaseLabel,
    elapsedObservationDays,
    minObservationDays: criteria.minObservationDays,
    validExecutions,
    minValidExecutions: criteria.minValidExecutions,
    daysCriterionMet,
    volumeCriterionMet,
    circuitBreakerTripped,
    criticalAlertCodes,
    holdExpired: decision === 'hold' && holdExpiry.expired,
    maxHoldDurationDays: holdExpiry.maxHoldDurationDays,
    nextPhase: decision === 'advance' ? criteria.nextPhase : null,
    reasons,
  };
}
