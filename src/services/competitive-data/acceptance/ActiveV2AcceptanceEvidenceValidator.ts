import type { ActiveV2ShadowReport } from '../../../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';
import { ACTIVE_STAGING_HOMOLOGATION_SCENARIOS } from '../../../equinox/competitive/active-staging/ActiveStagingHomologationAllowlist';
import { CRITICAL_COMPARATORS } from './ActiveV2AcceptancePolicy';

const SHA256_PATTERN = /^sha256-[a-f0-9]{64}$/;
const EXPECTED_SCENARIO_COUNT = ACTIVE_STAGING_HOMOLOGATION_SCENARIOS.length;

export interface EvidenceValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateActiveV2ShadowEvidence(evidence: unknown): EvidenceValidationResult {
  const errors: string[] = [];

  if (!evidence || typeof evidence !== 'object') {
    return { valid: false, errors: ['Evidence must be a non-null object.'] };
  }

  const report = evidence as Partial<ActiveV2ShadowReport>;
  const aggregate = report.aggregate as any;
  const scenarios = report.scenarios;

  if (!aggregate || typeof aggregate !== 'object') {
    errors.push('Missing or invalid aggregate block.');
  } else {
    // 1. targetCollection
    if (aggregate.targetCollection !== 'pokemonsets_v2_staging') {
      errors.push(`Invalid targetCollection: expected "pokemonsets_v2_staging", got "${aggregate.targetCollection}".`);
    }
    // 2. scenariosCompared
    if (aggregate.scenariosCompared !== EXPECTED_SCENARIO_COUNT) {
      errors.push(`Invalid scenariosCompared: expected ${EXPECTED_SCENARIO_COUNT}, got ${aggregate.scenariosCompared}.`);
    }

    // 4. readyForCompetitiveAcceptanceGate
    if (aggregate.readyForCompetitiveAcceptanceGate !== true) {
      errors.push('Evidence is not marked as ready for competitive acceptance gate.');
    }
    // 5. safety counters (reads/writes)
    if (aggregate.productionCollectionReads !== 0) {
      errors.push(`Safety breach: productionCollectionReads is ${aggregate.productionCollectionReads} (expected 0).`);
    }
    if (aggregate.observedMongoWriteCommands !== 0) {
      errors.push(`Safety breach: observedMongoWriteCommands is ${aggregate.observedMongoWriteCommands} (expected 0).`);
    }
    if (aggregate.recordsWritten !== 0) {
      errors.push(`Safety breach: recordsWritten is ${aggregate.recordsWritten} (expected 0).`);
    }
    if (aggregate.productionWrites !== 0) {
      errors.push(`Safety breach: productionWrites is ${aggregate.productionWrites} (expected 0).`);
    }
    // 6. fallbacks
    if (aggregate.baselineFallbackUsed !== false) {
      errors.push('Safety breach: baseline fallback was used.');
    }
    if (aggregate.activeV2FallbackUsed !== false) {
      errors.push('Safety breach: active V2 fallback was used.');
    }
    if (aggregate.localPilotFallbackUsed !== false) {
      errors.push('Safety breach: local pilot fallback was used.');
    }
    // 7. activeRunId
    if (!aggregate.activeRunId || typeof aggregate.activeRunId !== 'string' || aggregate.activeRunId.trim() === '') {
      errors.push('Missing activeRunId.');
    }
    // 8. baselineSourceVersion
    if (!aggregate.baselineSourceVersion || typeof aggregate.baselineSourceVersion !== 'string' || aggregate.baselineSourceVersion.trim() === '') {
      errors.push('Missing baselineSourceVersion.');
    }
    // 9. baselineSourceDigest
    if (!aggregate.baselineSourceDigest || typeof aggregate.baselineSourceDigest !== 'string' || !SHA256_PATTERN.test(aggregate.baselineSourceDigest)) {
      errors.push(`Invalid baselineSourceDigest: expected sha256 hex string with "sha256-" prefix, got "${aggregate.baselineSourceDigest}".`);
    }
    // 10. baselineSourceRecordCount
    if (typeof aggregate.baselineSourceRecordCount !== 'number' || aggregate.baselineSourceRecordCount <= 0) {
      errors.push(`Invalid baselineSourceRecordCount: expected positive number, got ${aggregate.baselineSourceRecordCount}.`);
    }
    // 11. activeV2DataDigest
    if (!aggregate.activeV2DataDigest || typeof aggregate.activeV2DataDigest !== 'string' || !SHA256_PATTERN.test(aggregate.activeV2DataDigest)) {
      errors.push(`Invalid activeV2DataDigest: expected sha256 hex string with "sha256-" prefix, got "${aggregate.activeV2DataDigest}".`);
    }
    // 12. activeV2RecordCount
    if (typeof aggregate.activeV2RecordCount !== 'number' || aggregate.activeV2RecordCount <= 0) {
      errors.push(`Invalid activeV2RecordCount: expected positive number, got ${aggregate.activeV2RecordCount}.`);
    }
    // 13. activeV2DataDigestAlgorithm
    if (aggregate.activeV2DataDigestAlgorithm !== 'active-v2-canonical-sha256-v1') {
      errors.push(`Invalid activeV2DataDigestAlgorithm: expected "active-v2-canonical-sha256-v1", got "${aggregate.activeV2DataDigestAlgorithm}".`);
    }
  }

  // scenarios check
  if (!Array.isArray(scenarios)) {
    errors.push('Missing or invalid scenarios array.');
  } else {
    if (scenarios.length !== EXPECTED_SCENARIO_COUNT) {
      errors.push(`Invalid scenarios count: expected ${EXPECTED_SCENARIO_COUNT}, got ${scenarios.length}.`);
    }

    const seenIds = new Set<string>();

    scenarios.forEach((scenario, index) => {
      if (!scenario || typeof scenario !== 'object') {
        errors.push(`Scenario at index ${index} is not an object.`);
        return;
      }

      const scenarioId = scenario.scenarioId;
      if (!scenarioId || typeof scenarioId !== 'string' || scenarioId.trim() === '') {
        errors.push(`Scenario at index ${index} is missing scenarioId.`);
      } else {
        if (seenIds.has(scenarioId)) {
          errors.push(`Duplicate scenarioId detected: "${scenarioId}".`);
        }
        seenIds.add(scenarioId);
      }

      // Check for baselineResult, activeV2Result, comparison
      const baselineResult = scenario.baselineResult;
      const activeV2Result = scenario.activeV2Result;
      const comparison = scenario.comparison;

      if (!baselineResult || typeof baselineResult !== 'object') {
        errors.push(`Scenario "${scenarioId || index}" is missing baselineResult.`);
      }
      if (!activeV2Result || typeof activeV2Result !== 'object') {
        errors.push(`Scenario "${scenarioId || index}" is missing activeV2Result.`);
      }

      if (!comparison || typeof comparison !== 'object') {
        errors.push(`Scenario "${scenarioId || index}" is missing comparison block.`);
      } else {
        if (comparison.differencesFullyRecorded !== true) {
          errors.push(`Scenario "${scenarioId || index}" has differencesFullyRecorded !== true.`);
        }
        // Validate presence of critical comparators
        CRITICAL_COMPARATORS.forEach(comp => {
          if (!comparison[comp] || typeof comparison[comp] !== 'object') {
            errors.push(`Scenario "${scenarioId || index}" is missing critical comparator "${comp}".`);
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
