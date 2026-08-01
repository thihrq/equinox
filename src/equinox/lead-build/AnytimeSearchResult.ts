import type { PokemonData } from '../core/AnalysisContext';
import type { CachedTeamEvaluation } from './LeadBuildCachedEvaluator';

export interface CompleteTeamCandidate {
  members: readonly PokemonData[];
  legalityPrecheckPassed: boolean;
  structuralCompletenessPassed: boolean;
  compositionCoverageScore: number;
  speciesIds: readonly string[];
  itemIds: readonly string[];
}

/**
 * Time COMPLETO (6 membros) rejeitado, com a decisão já computada.
 *
 * `cachedEvaluation` é o mesmo objeto que `evaluateFullTeamCached` já
 * produziu dentro do coordinator — carregado aqui, não recalculado. Isso é a
 * correção da 088-G para o incidente PRE-FINALIST-REJECTION-EVIDENCE-LOSS
 * (088-F): antes, só `acceptedTeams` atravessava a fronteira para
 * `PrimaryStrategySearch`, e a decisão de QUALQUER rejeição — mesmo já
 * calculada e completa — era descartada nesse ponto, nunca chegando ao
 * agregador de rejeições nem ao planner de recovery.
 */
export interface RejectedCompleteTeamResult {
  candidate: CompleteTeamCandidate;
  cachedEvaluation: CachedTeamEvaluation;
}

export type AnytimeStopReason =
  | 'ACCEPTED'
  | 'PRIMARY_TIME_BUDGET_REACHED'
  | 'NO_COMPLETE_TEAM'
  | 'SOURCE_EXHAUSTED';

export interface PartialTeamState {
  members: readonly PokemonData[];
  missingCapabilities: string[];
  score: number;
}

export interface AnytimeSearchResult {
  acceptedTeams: CompleteTeamCandidate[];
  rejectedTeams: RejectedCompleteTeamResult[];
  partialStates: PartialTeamState[];
  stopReason: AnytimeStopReason;
  strategiesAttemptedCount: number;
  firstCompleteTeamBuiltAtMs?: number;
}
