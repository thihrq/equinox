/**
 * Motivo de parada de uma tentativa de recovery para UMA estratégia.
 *
 * Antes, um único rótulo (`NOT_ELIGIBLE`) representava três condições
 * distintas — plano inelegível, orçamento de passes esgotado e fonte de
 * candidatos esgotada. Isso escondeu a causa raiz real da investigação
 * 087-D/087-E: um plano elegível mas sem nenhuma capability request
 * consumindo passes do orçamento global sem produzir efeito.
 */
export type RecoveryStrategyStopReason =
  | 'PLAN_NOT_ELIGIBLE'
  | 'NO_CAPABILITY_REQUESTS_DERIVED'
  | 'PASS_BUDGET_EXHAUSTED'
  | 'CANDIDATE_SOURCE_EXHAUSTED'
  | 'DEADLINE_REACHED'
  | 'NO_CAPABILITY_MATCH'
  | 'NO_COMPLETE_TEAM'
  | 'ALL_TEAMS_REJECTED'
  | 'TEAM_ACCEPTED';

export interface RecoveryStrategyDiagnostic {
  strategyId: string;

  planEligible: boolean;
  capabilityRequestCount: number;
  capabilityRequests: string[];
  ineligibilityReasons: string[];

  passesAvailableAtStart: number;
  passesConsumed: number;

  candidatesExamined: number;
  candidatesMatched: number;

  builderAttemptCount: number;
  completeTeamsBuilt: number;

  acceptanceDecisionCount: number;
  acceptanceAcceptedCount: number;
  acceptanceRejectionReasons: string[];

  recoveryExecuted: boolean;
  stopReason: RecoveryStrategyStopReason;
}

export interface RecoveryAggregateDiagnostic {
  recoveryEligibleAny: boolean;
  recoveryExecutedAny: boolean;
  recoveryExecutedCount: number;

  totalPassesConsumed: number;
  strategiesAttempted: number;
  strategiesSkippedNoRequests: number;
  strategiesSkippedPassBudget: number;

  acceptedTeamsTotal: number;

  perStrategy: RecoveryStrategyDiagnostic[];
}

/**
 * Deriva o agregado da requisição a partir dos diagnósticos por estratégia.
 *
 * Nunca é escrito diretamente — cada campo é uma função pura do array
 * `perStrategy`, para que nenhuma estratégia processada depois apague o
 * resultado de uma processada antes (o defeito confirmado na 087-D: o
 * `recoveryExecuted` agregado refletia só a última estratégia da requisição).
 */
export function buildAggregateRecoveryDiagnostic(
  perStrategy: RecoveryStrategyDiagnostic[],
): RecoveryAggregateDiagnostic {
  return {
    recoveryEligibleAny: perStrategy.some(item => item.planEligible),
    recoveryExecutedAny: perStrategy.some(item => item.recoveryExecuted),
    recoveryExecutedCount: perStrategy.filter(item => item.recoveryExecuted).length,
    totalPassesConsumed: perStrategy.reduce((sum, item) => sum + item.passesConsumed, 0),
    strategiesAttempted: perStrategy.length,
    strategiesSkippedNoRequests: perStrategy.filter(
      item => item.stopReason === 'NO_CAPABILITY_REQUESTS_DERIVED',
    ).length,
    strategiesSkippedPassBudget: perStrategy.filter(
      item => item.stopReason === 'PASS_BUDGET_EXHAUSTED',
    ).length,
    acceptedTeamsTotal: perStrategy.reduce((sum, item) => sum + item.acceptanceAcceptedCount, 0),
    perStrategy,
  };
}
