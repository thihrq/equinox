import type { PokemonData } from '../core/AnalysisContext';
import type { CandidateCapabilityIndex } from './CandidateCapabilityIndex';
import type { TeamCompositionPlan } from './TeamCompositionPlan';
import type { LeadBuildRequestContext } from './LeadBuildRequestContext';

export interface IncompleteSearchRecoveryInput {
  requestContext: LeadBuildRequestContext;
  compositionPlan: TeamCompositionPlan;
  partialStates: readonly { members: readonly PokemonData[]; missingCapabilities: string[] }[];
  initialCandidateBatch: readonly PokemonData[];
  capabilityIndex: CandidateCapabilityIndex;
  rejectedCandidateKeys: ReadonlySet<string>;
  evaluatedTeamKeys: ReadonlySet<string>;
}

export interface IncompleteSearchRecoveryPlan {
  targetCapabilitiesToFetch: readonly string[];
  maxCandidatesToFetch: number;
  usablePartialStates: readonly { members: readonly PokemonData[]; missingCapabilities: string[] }[];
}

export class IncompleteSearchRecoveryPlanner {
  public plan(input: IncompleteSearchRecoveryInput): IncompleteSearchRecoveryPlan {
    const { compositionPlan, partialStates, rejectedCandidateKeys } = input;

    const missingCapsSet = new Set<string>(compositionPlan.requiredCapabilities);

    for (const state of partialStates) {
      for (const cap of state.missingCapabilities) {
        missingCapsSet.add(cap);
      }
    }

    return {
      targetCapabilitiesToFetch: Array.from(missingCapsSet),
      maxCandidatesToFetch: 16,
      usablePartialStates: partialStates.filter(s => !rejectedCandidateKeys.has(s.members.map(m => m.name).join('_'))),
    };
  }
}
