import { classifyWave8Outcome, ExecutionEvidenceIdentity } from '../services/release-governance/ExecutionEvidence';

function expectThrows(label: string, fn: () => void, messageIncludes: string): void {
  let threw = false;
  try { fn(); } catch (error) { threw = error instanceof Error && error.message.includes(messageIncludes); }
  if (!threw) throw new Error(`EXECUTION_EVIDENCE_GUARD_NOT_CAUGHT:${label}`);
}
function assertEqual(label: string, actual: unknown, expected: unknown): void { if (actual !== expected) throw new Error(`EXECUTION_EVIDENCE_TEST_FAILED:${label} -- expected ${expected}, got ${actual}`); }

// Case: an isolated local simulation (this is what the real Wave 8 run 20260723T232100Z actually
// was -- deploymentTarget:"local-worktree-isolated" in its own authorization envelope) must
// classify as a dry-run, never as completed GA.
const isolatedSimulation: ExecutionEvidenceIdentity = {
  executionMode: 'isolated-production-simulation', evidenceClass: 'simulated', realPublicTrafficChanged: false,
  requestOrigin: 'deterministic-fixtures', metricsOrigin: 'local-runtime-instrumentation',
};
assertEqual('isolated-simulation-is-dry-run', classifyWave8Outcome(isolatedSimulation), 'WAVE 8 DRY-RUN APPROVED — GENERAL AVAILABILITY READINESS AND POST-LAUNCH STABILIZATION SIMULATION PASSED');

// Case: an offline dry-run is also never "completed".
const offlineDryRun: ExecutionEvidenceIdentity = {
  executionMode: 'offline-dry-run', evidenceClass: 'simulated', realPublicTrafficChanged: false,
  requestOrigin: 'deterministic-fixtures', metricsOrigin: 'local-runtime-instrumentation',
};
assertEqual('offline-dry-run-is-dry-run', classifyWave8Outcome(offlineDryRun), 'WAVE 8 DRY-RUN APPROVED — GENERAL AVAILABILITY READINESS AND POST-LAUNCH STABILIZATION SIMULATION PASSED');

// Case: claiming production-execution mode without real production evidence backing it must
// throw, not silently downgrade to dry-run and not silently approve.
const claimedProductionButSimulated: ExecutionEvidenceIdentity = {
  executionMode: 'production-execution', evidenceClass: 'simulated', realPublicTrafficChanged: false,
  requestOrigin: 'deterministic-fixtures', metricsOrigin: 'local-runtime-instrumentation',
};
expectThrows('production-mode-without-real-evidence', () => classifyWave8Outcome(claimedProductionButSimulated), 'GA_PRODUCTION_EVIDENCE_REQUIRED');

// Case: production-execution with production-observed evidence class but no real traffic change --
// still not enough, must throw.
const partialProductionEvidence: ExecutionEvidenceIdentity = {
  executionMode: 'production-execution', evidenceClass: 'production-observed', realPublicTrafficChanged: false,
  requestOrigin: 'authorized-production-traffic', metricsOrigin: 'provider-production-telemetry',
};
expectThrows('production-mode-no-real-traffic-change', () => classifyWave8Outcome(partialProductionEvidence), 'GA_PRODUCTION_EVIDENCE_REQUIRED');

// Case: the real thing -- production-execution, production-observed evidence, real traffic
// change, real request/metrics origin -- only this combination can classify as completed.
const genuineProductionEvidence: ExecutionEvidenceIdentity = {
  executionMode: 'production-execution', evidenceClass: 'production-observed', realPublicTrafficChanged: true,
  requestOrigin: 'authorized-production-traffic', metricsOrigin: 'provider-production-telemetry',
};
assertEqual('genuine-production-evidence-completes-ga', classifyWave8Outcome(genuineProductionEvidence), 'WAVE 8 APPROVED — GENERAL AVAILABILITY COMPLETED, POST-LAUNCH STABILIZATION PASSED');

console.log('execution evidence classification tests passed');
