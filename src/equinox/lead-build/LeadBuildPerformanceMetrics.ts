export interface LeadBuildPerformanceMetrics {
  rawCandidates: number;
  usableCandidates: number;
  batchesFetched: number;
  duplicateCount: number;
  rejectedMegaBeforeBeam: number;
  rejectedMegaInsideBeam: number;
  beamInputCandidates: number;
  beamExpandedStates: number;
  candidateFetchMs: number;
  strategyPipelineMs: number;
  qualityEvaluationMs: number;
  leadBuildTotalMs: number;
  acceptedStrategies: number;
}

export function classifyPerformanceStatus(totalMs: number): 'OPTIMAL' | 'ACCEPTABLE' | 'SEVERE_REGRESSION' {
  if (totalMs < 10000) return 'OPTIMAL';
  if (totalMs < 35860) return 'ACCEPTABLE';
  return 'SEVERE_REGRESSION';
}
