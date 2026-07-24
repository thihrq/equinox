// Wave 3 -- single source of truth for full-roster-expansion thresholds/rules. Mirrors the
// pattern already established and peer-reviewed in ExpertVerdictAggregationPolicy.ts: a versioned
// policy object plus a real assertConsistency() guard called once at module load, so drift between
// declared sub-rules and what the batch runner actually consumes fails immediately, everywhere.
export const FULL_ROSTER_EXPANSION_POLICY_ID = 'champions-wave3-full-roster-expansion-policy';
export const FULL_ROSTER_EXPANSION_POLICY_VERSION = 'wave3-full-roster-expansion-v1';

export type BatchStatus = 'planned' | 'running' | 'completed' | 'completed-with-warnings' | 'blocked' | 'failed' | 'resumed' | 'superseded';
export type SpeciesTerminalStatus = 'processed-with-validated-candidate' | 'processed-with-review-required-candidate' | 'processed-with-rejected-candidate' | 'processed-with-mixed-verdicts' | 'processed-no-legal-candidate' | 'blocked-by-data-defect' | 'blocked-by-unsupported-material-mechanic' | 'failed-after-retry-exhaustion';
export type CandidateTerminalStatus = 'expert-validated' | 'expert-review-required' | 'rejected' | 'generation-rejected' | 'blocked' | 'failed';
export type RetryClass = 'retryable' | 'non-retryable';

export interface FullRosterExpansionPolicy {
  policyId: string;
  policyVersion: string;
  regulationId: 'M-B';
  formatId: 'champions-reg-mb-doubles';
  maxCandidatesPerPokemon: number;
  candidateDistinctnessRules: { materialFields: readonly string[]; ignoredFields: readonly string[] };
  targetSelectionPolicyVersion: string;
  scenarioPolicyVersion: string;
  partnerSelectionPolicyVersion: string;
  targetCatalogExpansionPolicyVersion: string;
  evidenceRequirements: { minScenarioCount: number; minFullTeamStructureCount: number; requiredSpecialistIds: readonly string[] };
  specialistRequirements: { requiredSpecialistIds: readonly string[]; missingRequiredSpecialistBlocksValidated: true };
  verdictPolicyId: string;
  verdictPolicyVersion: string;
  batchPolicy: { speciesPerBatch: number; rationale: string; maxBatchDurationMsBudget: number };
  resumePolicy: { requiredDigestChecks: readonly string[]; reasonCodes: readonly string[] };
  failurePolicy: { retryClasses: Record<string, RetryClass>; maxRetryAttempts: number; retryDelayMs: number };
  packageInclusionPolicy: { includedVerdicts: readonly CandidateTerminalStatus[]; excludedVerdicts: readonly CandidateTerminalStatus[] };
  reasonCodeMappings: Readonly<Record<string, string>>;
  seedBase: string;
}

const TARGET_SELECTION_POLICY_VERSION = 'wave2-target-selection-v1';
const SCENARIO_POLICY_VERSION = 'wave2-candidate-scenario-v1';
const PARTNER_SELECTION_POLICY_VERSION = 'wave2-partner-selection-v1';
const TARGET_CATALOG_EXPANSION_POLICY_VERSION = 'wave2-target-catalog-expansion-v1';
const VERDICT_POLICY_ID = 'expert-verdict-aggregation-policy';
const VERDICT_POLICY_VERSION = 'expert-verdict-aggregation-v1';

const REQUIRED_SPECIALIST_IDS = ['deterministic-legality', 'damage-speed', 'set-coherence', 'role-archetype', 'doubles-strategy', 'full-team', 'competitive-benchmark', 'critical-review', 'format-rules', 'export-integrity'] as const;

export const FULL_ROSTER_EXPANSION_POLICY: FullRosterExpansionPolicy = {
  policyId: FULL_ROSTER_EXPANSION_POLICY_ID,
  policyVersion: FULL_ROSTER_EXPANSION_POLICY_VERSION,
  regulationId: 'M-B',
  formatId: 'champions-reg-mb-doubles',
  maxCandidatesPerPokemon: 2,
  candidateDistinctnessRules: {
    materialFields: ['role', 'archetype', 'item', 'ability', 'evProfile', 'speedProfile', 'movePackage', 'offensiveCategory'],
    ignoredFields: ['moveOrder', 'displayLabel', 'cosmeticEvSplitWithinSameCategory', 'nonMechanicalNotes'],
  },
  targetSelectionPolicyVersion: TARGET_SELECTION_POLICY_VERSION,
  scenarioPolicyVersion: SCENARIO_POLICY_VERSION,
  partnerSelectionPolicyVersion: PARTNER_SELECTION_POLICY_VERSION,
  targetCatalogExpansionPolicyVersion: TARGET_CATALOG_EXPANSION_POLICY_VERSION,
  evidenceRequirements: { minScenarioCount: 6, minFullTeamStructureCount: 5, requiredSpecialistIds: REQUIRED_SPECIALIST_IDS },
  specialistRequirements: { requiredSpecialistIds: REQUIRED_SPECIALIST_IDS, missingRequiredSpecialistBlocksValidated: true },
  verdictPolicyId: VERDICT_POLICY_ID,
  verdictPolicyVersion: VERDICT_POLICY_VERSION,
  // 20 species/batch: measured from Wave 2's real 20-species pilot (40 candidates, 240 scenarios,
  // 200 full-team structures, p50~1ms/p95~1-2ms per candidate) -- fast enough that batch size is
  // bounded by artifact/isolation manageability, not raw compute time. Not an arbitrary pick.
  batchPolicy: { speciesPerBatch: 20, rationale: 'measured against Wave 2 pilot performance.json (p50~1ms, p95~1-2ms per candidate); 20 species x up to 2 candidates keeps each batch artifact set small and independently auditable while still processing the 173-species remainder in <=9 batches', maxBatchDurationMsBudget: 60000 },
  resumePolicy: {
    requiredDigestChecks: ['packageDigest', 'policyVersion', 'targetCatalogDigest', 'inputDigest'],
    reasonCodes: ['RESUME_INPUT_DIGEST_MISMATCH', 'RESUME_POLICY_VERSION_MISMATCH', 'RESUME_TARGET_CATALOG_MISMATCH', 'RESUME_SOURCE_DIGEST_MISMATCH', 'RESUME_BATCH_ALREADY_COMPLETE', 'RESUME_BATCH_INCOMPLETE', 'RESUME_CHECKPOINT_INVALID', 'RESUME_ARTIFACT_MISSING', 'RESUME_RESTART_REQUIRED'],
  },
  failurePolicy: {
    retryClasses: {
      ARTIFACT_ATOMIC_RENAME_BLOCKED: 'retryable', FILESYSTEM_TRANSIENT: 'retryable', TIMEOUT: 'retryable',
      ILLEGAL_CANDIDATE: 'non-retryable', DIGEST_MISMATCH: 'non-retryable', POLICY_INCONSISTENCY: 'non-retryable',
      SOURCE_CORRUPTION: 'non-retryable', TARGET_CATALOG_INVALID: 'non-retryable', UNSUPPORTED_MATERIAL: 'non-retryable', INVARIANT_VIOLATION: 'non-retryable', DETERMINISTIC_TEST_FAILURE: 'non-retryable',
    },
    maxRetryAttempts: 3,
    retryDelayMs: 0,
  },
  packageInclusionPolicy: { includedVerdicts: ['expert-validated'], excludedVerdicts: ['expert-review-required', 'rejected', 'generation-rejected', 'blocked', 'failed'] },
  reasonCodeMappings: {
    RESUME_INPUT_DIGEST_MISMATCH: 'batch input changed since the checkpoint was written; batch invalidated, new attempt created',
    RESUME_POLICY_VERSION_MISMATCH: 'FullRosterExpansionPolicy.policyVersion changed since the checkpoint; batch invalidated',
    RESUME_TARGET_CATALOG_MISMATCH: 'Wave 2 target catalog digest changed since the checkpoint; batch invalidated',
    RESUME_SOURCE_DIGEST_MISMATCH: 'package/roster source digest changed since the checkpoint; batch invalidated',
    RESUME_BATCH_ALREADY_COMPLETE: 'batch checkpoint reports completed with valid digests; skipped, not reprocessed',
    RESUME_BATCH_INCOMPLETE: 'batch checkpoint reports an incomplete run; resumed from the last valid stage',
    RESUME_CHECKPOINT_INVALID: 'checkpoint file failed schema/digest validation; batch invalidated, new attempt created',
    RESUME_ARTIFACT_MISSING: 'a required batch artifact file is missing despite a completed checkpoint; batch invalidated',
    RESUME_RESTART_REQUIRED: 'no valid checkpoint exists; batch starts fresh',
  },
  seedBase: 'champions-mb-full-roster-expansion-v1',
};

export function assertFullRosterExpansionPolicyConsistency(policy: FullRosterExpansionPolicy): void {
  if (!policy.policyId || !policy.policyVersion) throw new Error('FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: policyId/policyVersion missing');
  if (!Number.isFinite(policy.maxCandidatesPerPokemon) || policy.maxCandidatesPerPokemon < 1) throw new Error('FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: maxCandidatesPerPokemon invalid');
  if (!Number.isFinite(policy.batchPolicy.speciesPerBatch) || policy.batchPolicy.speciesPerBatch < 1) throw new Error('FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: batchPolicy.speciesPerBatch invalid');
  if (!Number.isFinite(policy.failurePolicy.maxRetryAttempts) || policy.failurePolicy.maxRetryAttempts < 1 || policy.failurePolicy.maxRetryAttempts > 10) throw new Error('FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: failurePolicy.maxRetryAttempts must be bounded (1-10), retry policy cannot be unlimited');
  // Package inclusion must be a strict subset of, and disjoint from, the excluded set -- and must
  // not contradict the verdict policy's own terminal-state universe.
  const allTerminalStates: readonly CandidateTerminalStatus[] = ['expert-validated', 'expert-review-required', 'rejected', 'generation-rejected', 'blocked', 'failed'];
  const included = new Set(policy.packageInclusionPolicy.includedVerdicts);
  const excluded = new Set(policy.packageInclusionPolicy.excludedVerdicts);
  for (const state of included) if (excluded.has(state)) throw new Error(`FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: packageInclusionPolicy lists ${state} as both included and excluded`);
  for (const state of allTerminalStates) if (!included.has(state) && !excluded.has(state)) throw new Error(`FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: terminal state ${state} is neither included nor excluded by packageInclusionPolicy`);
  if (included.size !== 1 || !included.has('expert-validated')) throw new Error('FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: packageInclusionPolicy must include exactly expert-validated (mission section 30: pacote contendo exclusivamente candidates verdict=expert-validated)');
  // Every resume reason code declared in resumePolicy.reasonCodes must have a mapping explaining
  // it, and vice versa -- the exact class of drift assertPolicyConsistency() was built to catch
  // in ExpertVerdictAggregationPolicy.ts.
  for (const code of policy.resumePolicy.reasonCodes) if (!policy.reasonCodeMappings[code]) throw new Error(`FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: resume reason code ${code} has no entry in reasonCodeMappings`);
  for (const code of Object.keys(policy.reasonCodeMappings)) if (!policy.resumePolicy.reasonCodes.includes(code)) throw new Error(`FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: reasonCodeMappings has an entry (${code}) not declared in resumePolicy.reasonCodes`);
  if (policy.evidenceRequirements.minScenarioCount < 1 || policy.evidenceRequirements.minFullTeamStructureCount < 1) throw new Error('FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: evidenceRequirements thresholds must be positive');
  if (JSON.stringify([...policy.specialistRequirements.requiredSpecialistIds].sort()) !== JSON.stringify([...policy.evidenceRequirements.requiredSpecialistIds].sort())) throw new Error('FULL_ROSTER_EXPANSION_POLICY_INCONSISTENT: specialistRequirements and evidenceRequirements must agree on the required specialist set (single source of truth)');
}

assertFullRosterExpansionPolicyConsistency(FULL_ROSTER_EXPANSION_POLICY);
