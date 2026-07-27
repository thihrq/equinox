import type { PokemonData } from '../core/AnalysisContext';

export interface CompleteTeamCandidate {
  members: readonly PokemonData[];
  legalityPrecheckPassed: boolean;
  structuralCompletenessPassed: boolean;
  compositionCoverageScore: number;
  speciesIds: readonly string[];
  itemIds: readonly string[];
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
  rejectedTeams: CompleteTeamCandidate[];
  partialStates: PartialTeamState[];
  stopReason: AnytimeStopReason;
  strategiesAttemptedCount: number;
  firstCompleteTeamBuiltAtMs?: number;
}
