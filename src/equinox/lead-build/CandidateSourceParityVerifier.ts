import { CandidateSourceParityManifest } from './CandidateSourceParityManifest';

export type ParityDifferenceSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export interface CandidateSourceParityDifference {
  path: string;
  expected: unknown;
  actual: unknown;
  severity: ParityDifferenceSeverity;
  reasonCode: string;
}

export interface CandidateSourceParityResult {
  valid: boolean;

  blockingDifferences: readonly CandidateSourceParityDifference[];
  warnings: readonly CandidateSourceParityDifference[];
  informationalDifferences: readonly CandidateSourceParityDifference[];

  expectedManifestDigest: string;
  actualManifestDigest: string;
}

export function verifyCandidateSourceParity(
  expected: CandidateSourceParityManifest,
  actual: CandidateSourceParityManifest,
): CandidateSourceParityResult {
  const blockingDifferences: CandidateSourceParityDifference[] = [];
  const warnings: CandidateSourceParityDifference[] = [];
  const informationalDifferences: CandidateSourceParityDifference[] = [];

  // 1. Identidade do software (Bloqueantes)
  if (expected.software.queryVersion !== actual.software.queryVersion) {
    blockingDifferences.push({
      path: 'software.queryVersion',
      expected: expected.software.queryVersion,
      actual: actual.software.queryVersion,
      severity: 'BLOCKING',
      reasonCode: 'QUERY_VERSION_MISMATCH',
    });
  }

  if (expected.software.filterVersion !== actual.software.filterVersion) {
    blockingDifferences.push({
      path: 'software.filterVersion',
      expected: expected.software.filterVersion,
      actual: actual.software.filterVersion,
      severity: 'BLOCKING',
      reasonCode: 'FILTER_VERSION_MISMATCH',
    });
  }

  if (expected.software.stratifierVersion !== actual.software.stratifierVersion) {
    blockingDifferences.push({
      path: 'software.stratifierVersion',
      expected: expected.software.stratifierVersion,
      actual: actual.software.stratifierVersion,
      severity: 'BLOCKING',
      reasonCode: 'STRATIFIER_VERSION_MISMATCH',
    });
  }

  if (expected.software.evaluatorVersion !== actual.software.evaluatorVersion) {
    blockingDifferences.push({
      path: 'software.evaluatorVersion',
      expected: expected.software.evaluatorVersion,
      actual: actual.software.evaluatorVersion,
      severity: 'BLOCKING',
      reasonCode: 'EVALUATOR_VERSION_MISMATCH',
    });
  }

  if (expected.software.artifactDigest && actual.software.artifactDigest && expected.software.artifactDigest !== actual.software.artifactDigest) {
    blockingDifferences.push({
      path: 'software.artifactDigest',
      expected: expected.software.artifactDigest,
      actual: actual.software.artifactDigest,
      severity: 'BLOCKING',
      reasonCode: 'ARTIFACT_DIGEST_MISMATCH',
    });
  }

  // 2. Identidade dos dados competitivos (Bloqueantes & Warnings)
  if (expected.competitiveData.sourceMode !== actual.competitiveData.sourceMode) {
    blockingDifferences.push({
      path: 'competitiveData.sourceMode',
      expected: expected.competitiveData.sourceMode,
      actual: actual.competitiveData.sourceMode,
      severity: 'BLOCKING',
      reasonCode: 'SOURCE_MODE_MISMATCH',
    });
  }

  if (expected.competitiveData.competitivePackageDigest !== actual.competitiveData.competitivePackageDigest) {
    blockingDifferences.push({
      path: 'competitiveData.competitivePackageDigest',
      expected: expected.competitiveData.competitivePackageDigest,
      actual: actual.competitiveData.competitivePackageDigest,
      severity: 'BLOCKING',
      reasonCode: 'COMPETITIVE_PACKAGE_DIGEST_MISMATCH',
    });
  }

  if (expected.competitiveData.competitiveSetDigest !== actual.competitiveData.competitiveSetDigest) {
    blockingDifferences.push({
      path: 'competitiveData.competitiveSetDigest',
      expected: expected.competitiveData.competitiveSetDigest,
      actual: actual.competitiveData.competitiveSetDigest,
      severity: 'BLOCKING',
      reasonCode: 'COMPETITIVE_SET_DIGEST_MISMATCH',
    });
  }

  if (expected.competitiveData.pokemonDocumentCount !== actual.competitiveData.pokemonDocumentCount) {
    warnings.push({
      path: 'competitiveData.pokemonDocumentCount',
      expected: expected.competitiveData.pokemonDocumentCount,
      actual: actual.competitiveData.pokemonDocumentCount,
      severity: 'WARNING',
      reasonCode: 'DOCUMENT_COUNT_DIFFERENCE',
    });
  }

  if (expected.competitiveData.competitiveSetCount !== actual.competitiveData.competitiveSetCount) {
    warnings.push({
      path: 'competitiveData.competitiveSetCount',
      expected: expected.competitiveData.competitiveSetCount,
      actual: actual.competitiveData.competitiveSetCount,
      severity: 'WARNING',
      reasonCode: 'SET_COUNT_DIFFERENCE',
    });
  }

  // 3. Feature Flags (Bloqueantes se comportamentais)
  const expectedFlags = expected.runtime.relevantFeatureFlags || {};
  const actualFlags = actual.runtime.relevantFeatureFlags || {};
  const allKeys = Array.from(new Set([...Object.keys(expectedFlags), ...Object.keys(actualFlags)]));

  for (const k of allKeys) {
    if (expectedFlags[k] !== actualFlags[k]) {
      blockingDifferences.push({
        path: `runtime.relevantFeatureFlags.${k}`,
        expected: expectedFlags[k],
        actual: actualFlags[k],
        severity: 'BLOCKING',
        reasonCode: 'BEHAVIOR_FEATURE_FLAG_MISMATCH',
      });
    }
  }

  // 4. Runtime / Ambiente (Informativos)
  if (expected.runtime.runtimeProfile !== actual.runtime.runtimeProfile) {
    informationalDifferences.push({
      path: 'runtime.runtimeProfile',
      expected: expected.runtime.runtimeProfile,
      actual: actual.runtime.runtimeProfile,
      severity: 'INFO',
      reasonCode: 'RUNTIME_PROFILE_DIFFERENCE',
    });
  }

  if (expected.runtime.environment !== actual.runtime.environment) {
    informationalDifferences.push({
      path: 'runtime.environment',
      expected: expected.runtime.environment,
      actual: actual.runtime.environment,
      severity: 'INFO',
      reasonCode: 'ENVIRONMENT_DIFFERENCE',
    });
  }

  if (expected.runtime.nodeVersion !== actual.runtime.nodeVersion) {
    informationalDifferences.push({
      path: 'runtime.nodeVersion',
      expected: expected.runtime.nodeVersion,
      actual: actual.runtime.nodeVersion,
      severity: 'INFO',
      reasonCode: 'NODE_VERSION_DIFFERENCE',
    });
  }

  const valid = blockingDifferences.length === 0;

  return {
    valid,
    blockingDifferences,
    warnings,
    informationalDifferences,
    expectedManifestDigest: expected.manifestDigest,
    actualManifestDigest: actual.manifestDigest,
  };
}
