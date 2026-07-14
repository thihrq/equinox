import type { ActiveStagingEngineInput } from './ActiveStagingEngineAdapter';

export interface ActiveStagingTeamDataTrace {
  competitiveVerificationState: 'staging-controlled';
  expectedActiveV2SetsResolvedFromMongo: string[];
  expectedActiveV2SetsPresentedToEngine: string[];
  expectedActiveV2SetsAppliedToTeamData: string[];
  localPilotFallbackUsed: false;
}

export type TeamDataWithActiveStagingTrace<T extends object> = T & ActiveStagingTeamDataTrace;

export function applyActiveStagingTraceToTeamData<T extends object>(
  teamData: T,
  input: ActiveStagingEngineInput,
  appliedSetIds: string[] = input.expectedActiveV2SetsPresentedToEngine,
): TeamDataWithActiveStagingTrace<T> {
  return {
    ...teamData,
    competitiveVerificationState: 'staging-controlled',
    expectedActiveV2SetsResolvedFromMongo: [...input.expectedActiveV2SetsResolvedFromMongo],
    expectedActiveV2SetsPresentedToEngine: [...input.expectedActiveV2SetsPresentedToEngine],
    expectedActiveV2SetsAppliedToTeamData: [...appliedSetIds],
    localPilotFallbackUsed: false,
  };
}
