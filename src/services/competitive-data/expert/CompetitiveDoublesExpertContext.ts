import { ExpertCandidateRef, ExpertEngineExecutionState } from './CompetitiveDoublesExpertTypes';

export interface CompetitiveDoublesExpertContext {
  regulationId: 'M-B';
  candidate: ExpertCandidateRef;
  sourcePackageDigest: string;
  execution: ExpertEngineExecutionState;
}

export function createContractsOnlyExpertContext(
  candidate: ExpertCandidateRef,
  sourcePackageDigest: string,
): CompetitiveDoublesExpertContext {
  return {
    regulationId: 'M-B',
    candidate,
    sourcePackageDigest,
    execution: { executed: false, executionReason: 'contracts-only' },
  };
}
