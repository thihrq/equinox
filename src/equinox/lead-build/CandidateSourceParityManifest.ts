import crypto from 'crypto';

export interface SoftwareParityIdentity {
  sourceCommit: string;
  artifactDigest?: string;

  queryVersion: string;
  filterVersion: string;
  stratifierVersion: string;
  evaluatorVersion: string;
}

export interface CompetitiveDataParityIdentity {
  sourceMode: string;

  competitivePackageDigest: string;
  competitiveSetDigest: string;

  pokemonDocumentCount: number;
  competitiveSetCount: number;
}

export interface RuntimeParityIdentity {
  nodeVersion: string;
  runtimeProfile: string;
  environment: string;

  relevantFeatureFlags: Readonly<Record<string, string>>;
}

export interface CandidateSourceParityManifest {
  schemaVersion: string;
  generatedAt: string;

  software: SoftwareParityIdentity;
  competitiveData: CompetitiveDataParityIdentity;
  runtime: RuntimeParityIdentity;

  manifestDigest: string;
}

export const LEAD_BUILD_PARITY_ENV_KEYS = [
  'EQUINOX_RUNTIME_PROFILE',
  'EQUINOX_CANDIDATE_SOURCE_MODE',
  'EQUINOX_LEAD_BUILD_ENABLED',
  'EQUINOX_DEFENSIVE_QUALITY_ENABLED',
  'EQUINOX_SET_COHERENCE_ENABLED',
] as const;

function sanitizeValue(value: string): string {
  if (
    /mongodb(\+srv)?:\/\//i.test(value) ||
    /bearer\s+/i.test(value) ||
    /secret|password|key|token|auth/i.test(value)
  ) {
    return '[REDACTED_SECRET]';
  }
  return value;
}

export function sortRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(record).sort();
  for (const k of keys) {
    sorted[k] = sanitizeValue(record[k] ?? '');
  }
  return sorted;
}

export function computeCanonicalManifestDigest(manifest: Omit<CandidateSourceParityManifest, 'generatedAt' | 'manifestDigest'>): string {
  const canonicalPayload = {
    schemaVersion: manifest.schemaVersion,
    software: {
      sourceCommit: manifest.software.sourceCommit,
      artifactDigest: manifest.software.artifactDigest || '',
      queryVersion: manifest.software.queryVersion,
      filterVersion: manifest.software.filterVersion,
      stratifierVersion: manifest.software.stratifierVersion,
      evaluatorVersion: manifest.software.evaluatorVersion,
    },
    competitiveData: {
      sourceMode: manifest.competitiveData.sourceMode,
      competitivePackageDigest: manifest.competitiveData.competitivePackageDigest,
      competitiveSetDigest: manifest.competitiveData.competitiveSetDigest,
      pokemonDocumentCount: manifest.competitiveData.pokemonDocumentCount,
      competitiveSetCount: manifest.competitiveData.competitiveSetCount,
    },
    runtime: {
      nodeVersion: manifest.runtime.nodeVersion,
      runtimeProfile: manifest.runtime.runtimeProfile,
      environment: manifest.runtime.environment,
      relevantFeatureFlags: sortRecord(manifest.runtime.relevantFeatureFlags),
    },
  };

  const jsonString = JSON.stringify(canonicalPayload);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  return `sha256:${hash}`;
}

export function createCandidateSourceParityManifest(params: {
  software: SoftwareParityIdentity;
  competitiveData: CompetitiveDataParityIdentity;
  runtime: Omit<RuntimeParityIdentity, 'relevantFeatureFlags'> & { relevantFeatureFlags?: Record<string, string> };
}): CandidateSourceParityManifest {
  const envFlags: Record<string, string> = {};
  for (const key of LEAD_BUILD_PARITY_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      envFlags[key] = process.env[key]!;
    }
  }

  const mergedFlags = { ...envFlags, ...(params.runtime.relevantFeatureFlags || {}) };

  const partialManifest = {
    schemaVersion: '1.0.0',
    software: params.software,
    competitiveData: params.competitiveData,
    runtime: {
      ...params.runtime,
      relevantFeatureFlags: sortRecord(mergedFlags),
    },
  };

  const manifestDigest = computeCanonicalManifestDigest(partialManifest);

  return {
    ...partialManifest,
    generatedAt: new Date().toISOString(),
    manifestDigest,
  };
}
