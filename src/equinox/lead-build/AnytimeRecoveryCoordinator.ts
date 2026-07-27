import type { PokemonData } from '../core/AnalysisContext';

export type AnytimeRecoveryOutcome =
  | {
      kind: 'ACCEPTED';
      strategy: any;
    }
  | {
      kind: 'EVALUATED_AND_REJECTED';
      evaluatedTeams: number;
      rejectionSummary: { reason: string; count: number }[];
    }
  | {
      kind: 'NO_COMPLETE_TEAM_PRODUCED';
      missingCapabilities: string[];
    }
  | {
      kind: 'TIME_BUDGET_REACHED';
      partialStatesPreserved: number;
    };

export class AnytimeRecoveryCoordinator {
  public coordinate(
    executed: boolean,
    acceptedStrategy?: any,
    evaluatedTeamsCount: number = 0,
    preservedPartialCount: number = 0,
  ): AnytimeRecoveryOutcome {
    if (executed && acceptedStrategy) {
      return {
        kind: 'ACCEPTED',
        strategy: acceptedStrategy,
      };
    }

    if (evaluatedTeamsCount > 0) {
      return {
        kind: 'EVALUATED_AND_REJECTED',
        evaluatedTeams: evaluatedTeamsCount,
        rejectionSummary: [{ reason: 'QUALITY_GATES_NOT_SATISFIED', count: evaluatedTeamsCount }],
      };
    }

    if (preservedPartialCount > 0) {
      return {
        kind: 'TIME_BUDGET_REACHED',
        partialStatesPreserved: preservedPartialCount,
      };
    }

    return {
      kind: 'NO_COMPLETE_TEAM_PRODUCED',
      missingCapabilities: ['balanced_coverage'],
    };
  }
}
