import type { ActiveV2CanaryMode } from '../runtime-control/ActiveV2CanaryConfigTypes';

/**
 * Identifica uma fase observável do rollout progressivo (Fases 3, 5-10 do
 * adendo original) pela combinação mode+percentage já persistida em
 * `ActiveV2CanaryConfig`. `percentage` só é relevante quando mode ===
 * 'percentage'; para os demais modos é sempre null.
 */
export interface ActiveV2CanaryPhaseKey {
  mode: ActiveV2CanaryMode;
  percentage: number | null;
}

export interface ActiveV2CanaryPhaseCriteria {
  /** Nome da fase no adendo original, só para leitura humana em relatórios. */
  phaseLabel: string;
  minObservationDays: number;
  minValidExecutions: number;
  /** Próxima fase da progressão, ou null quando é a fase terminal (100%). */
  nextPhase: ActiveV2CanaryPhaseKey | null;
}

function phaseKey(mode: ActiveV2CanaryMode, percentage: number | null): string {
  return percentage === null ? mode : `${mode}:${percentage}`;
}

/**
 * Critérios de tempo+volume por fase (adendo original, seções "Fase 3" e
 * "Fase 5" a "Fase 10"). Modos sem janela de observação própria ('off') não
 * aparecem aqui — o gate de progressão (`ActiveV2CanaryPhaseProgressionGate`)
 * simplesmente não os avalia. `nextPhase` reflete apenas a progressão de
 * *modo/percentual de canário*; pré-requisitos de infraestrutura de fases
 * intermediárias do plano (ex: Fase 4/4A/4B entre o shadow e o canário
 * interno) não são modelados aqui e continuam exigindo confirmação humana
 * separada antes de autorizar a transição real via
 * `ActiveV2CanaryTransitionPolicy`.
 */
const ACTIVE_V2_CANARY_PHASE_CRITERIA_TABLE: Record<string, ActiveV2CanaryPhaseCriteria> = {
  [phaseKey('shadow', null)]: {
    phaseLabel: 'Fase 3 — Runtime Shadow Mode',
    minObservationDays: 7,
    minValidExecutions: 1000,
    nextPhase: { mode: 'internal', percentage: null },
  },
  [phaseKey('internal', null)]: {
    phaseLabel: 'Fase 5 — Canary Interno',
    minObservationDays: 3,
    minValidExecutions: 100,
    nextPhase: { mode: 'percentage', percentage: 5 },
  },
  [phaseKey('percentage', 5)]: {
    phaseLabel: 'Fase 6 — Canary Público 5%',
    minObservationDays: 7,
    minValidExecutions: 1000,
    nextPhase: { mode: 'percentage', percentage: 10 },
  },
  [phaseKey('percentage', 10)]: {
    phaseLabel: 'Fase 7 — Canary Público 10%',
    minObservationDays: 5,
    minValidExecutions: 2000,
    nextPhase: { mode: 'percentage', percentage: 25 },
  },
  [phaseKey('percentage', 25)]: {
    phaseLabel: 'Fase 8 — Canary Público 25%',
    minObservationDays: 7,
    minValidExecutions: 5000,
    nextPhase: { mode: 'percentage', percentage: 50 },
  },
  [phaseKey('percentage', 50)]: {
    phaseLabel: 'Fase 9 — Canary Público 50%',
    minObservationDays: 7,
    minValidExecutions: 10000,
    nextPhase: { mode: 'full', percentage: null },
  },
  [phaseKey('full', null)]: {
    phaseLabel: 'Fase 10 — Rollout 100% (janela de estabilização inicial)',
    minObservationDays: 14,
    // O adendo não define um piso de execuções para a janela de
    // estabilização de 100% — só o mínimo de 14 dias corridos.
    minValidExecutions: 0,
    // Terminal para fins deste gate: o que vem depois (Fase 11 estabilização,
    // Fase 12 encerramento da migração) é trabalho operacional/de limpeza,
    // não mais uma progressão de percentual de canário.
    nextPhase: null,
  },
};

/**
 * Devolve os critérios de observação da fase atual, ou null quando o modo
 * informado não tem janela de observação própria no adendo (ex: 'off').
 */
export function getActiveV2CanaryPhaseCriteria(phase: ActiveV2CanaryPhaseKey): ActiveV2CanaryPhaseCriteria | null {
  return ACTIVE_V2_CANARY_PHASE_CRITERIA_TABLE[phaseKey(phase.mode, phase.percentage)] ?? null;
}
