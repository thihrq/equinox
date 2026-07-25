// Release governance -- distinguishes simulated/dry-run evidence from real production-observed
// evidence. Exists because the prior Wave 8 run (20260723T232100Z) classified itself
// "GENERAL AVAILABILITY COMPLETED" while its own authorization envelope recorded
// deploymentTarget:"local-worktree-isolated" and a placeholder artifactDigest
// ("sha256:wave8-build-digest-e9abeb5", not a real 64-hex sha256) -- i.e. it was a simulation,
// not real production traffic. classifyWave8Outcome() enforces that "GA completed" can only be
// claimed when the evidence actually came from authorized production traffic and provider
// telemetry, never from local fixtures, regardless of what the surrounding report text claims.
export type ExecutionMode = 'offline-dry-run' | 'isolated-production-simulation' | 'production-execution';

export type EvidenceClass = 'simulated' | 'production-observed';

export interface ExecutionEvidenceIdentity {
  executionMode: ExecutionMode;
  evidenceClass: EvidenceClass;
  realPublicTrafficChanged: boolean;
  requestOrigin: 'deterministic-fixtures' | 'synthetic-load' | 'authorized-production-traffic';
  metricsOrigin: 'local-runtime-instrumentation' | 'provider-production-telemetry';
}

export type Wave8Classification =
  | 'WAVE 8 DRY-RUN APPROVED — GENERAL AVAILABILITY READINESS AND POST-LAUNCH STABILIZATION SIMULATION PASSED'
  | 'WAVE 8 APPROVED — GENERAL AVAILABILITY COMPLETED, POST-LAUNCH STABILIZATION PASSED';

export function classifyWave8Outcome(evidence: ExecutionEvidenceIdentity): Wave8Classification {
  const isRealProductionEvidence =
    evidence.executionMode === 'production-execution' &&
    evidence.evidenceClass === 'production-observed' &&
    evidence.realPublicTrafficChanged &&
    evidence.requestOrigin === 'authorized-production-traffic' &&
    evidence.metricsOrigin === 'provider-production-telemetry';

  if (isRealProductionEvidence) return 'WAVE 8 APPROVED — GENERAL AVAILABILITY COMPLETED, POST-LAUNCH STABILIZATION PASSED';

  const isDryRun = evidence.executionMode === 'offline-dry-run' || evidence.executionMode === 'isolated-production-simulation';
  if (isDryRun) return 'WAVE 8 DRY-RUN APPROVED — GENERAL AVAILABILITY READINESS AND POST-LAUNCH STABILIZATION SIMULATION PASSED';

  // executionMode === 'production-execution' but the evidence doesn't actually back it up
  // (e.g. simulated evidenceClass, no real traffic change, fixture-origin requests) --
  // never allow a "completed" claim built on evidence that doesn't match the claimed mode.
  throw new Error('GA_PRODUCTION_EVIDENCE_REQUIRED');
}
