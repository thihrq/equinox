import type { CompetitiveClassification } from '../acceptance/ActiveV2AcceptanceTypes';

export type ActiveV2RuntimeOutcome = 'success' | 'error' | 'timeout' | 'skipped';

export type ActiveV2RuntimeFallbackReason =
  | 'v2-error'
  | 'v2-timeout'
  | 'v2-disabled'
  | 'circuit-breaker'
  | 'force-baseline'
  | 'digest-mismatch'
  | 'no-v2-data'
  /**
   * Mais de um set ativo encontrado para o mesmo Pokémon+formato (a
   * coleção permite isso — o índice único é por setId, não por
   * pokemonName). Distinto de 'no-v2-data' porque sinaliza uma condição
   * de curação a resolver (ambiguidade), não uma lacuna de cobertura.
   */
  | 'ambiguous-v2-data'
  | 'unknown';

export interface ActiveV2RuntimeTelemetryEvent {
  eventId: string;
  occurredAt: string;
  requestId: string;
  format: string;
  teamIdentity: string;
  archetype: string;
  publishRunId: string | null;
  activeV2DataDigest: string | null;
  baseline: {
    outcome: 'success' | 'error';
    latencyMs: number;
  };
  v2: {
    outcome: ActiveV2RuntimeOutcome;
    latencyMs: number | null;
    fallbackTriggered: boolean;
    fallbackReason: ActiveV2RuntimeFallbackReason | null;
  };
  comparison: {
    classification: CompetitiveClassification;
    scoreDelta: number | null;
  } | null;
}

export interface ActiveV2RuntimeLatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface ActiveV2RuntimeSegmentBreakdown {
  format: Record<string, number>;
  teamIdentity: Record<string, number>;
  archetype: Record<string, number>;
}

export interface ActiveV2RuntimeMetricsSnapshot {
  windowStartedAt: string;
  windowEndedAt: string;
  requestCount: number;
  baseline: {
    successCount: number;
    errorCount: number;
    latency: ActiveV2RuntimeLatencyPercentiles;
  };
  v2: {
    successCount: number;
    errorCount: number;
    timeoutCount: number;
    skippedCount: number;
    latency: ActiveV2RuntimeLatencyPercentiles;
  };
  fallback: {
    count: number;
    reasonCounts: Record<ActiveV2RuntimeFallbackReason, number>;
  };
  classificationCounts: Record<CompetitiveClassification, number>;
  observedPublishRunIds: string[];
  observedActiveV2DataDigests: string[];
  segments: ActiveV2RuntimeSegmentBreakdown;
}

export interface ActiveV2RuntimeManifestHealthSnapshot {
  activeSetCount: number;
  activeSetIdsWithMultipleActiveVersions: string[];
  activeManifest: {
    publishRunId: string;
    status: string;
    activeV2DataDigest: string;
    recordedRecordCount: number;
  } | null;
  manifestRecordCountMatchesActiveSetCount: boolean;
  recomputedActiveV2DataDigest: string | null;
  digestMatchesManifest: boolean;
}

export type ActiveV2RuntimeAlertCode =
  | 'V2_ERROR_RATE'
  | 'V2_TIMEOUT_RATE'
  | 'FALLBACK_RATE'
  | 'BLOCKER_CLASSIFICATION_PRESENT'
  | 'P95_LATENCY_DEGRADATION'
  | 'ZERO_ACTIVE_SETS'
  | 'MULTIPLE_ACTIVE_VERSIONS'
  | 'MANIFEST_INCONSISTENCY'
  | 'DIGEST_MISMATCH';

export type ActiveV2RuntimeAlertSeverity = 'critical' | 'warning';

export interface ActiveV2RuntimeAlert {
  code: ActiveV2RuntimeAlertCode;
  severity: ActiveV2RuntimeAlertSeverity;
  message: string;
  observedValue: number | string;
  thresholdValue: number | string | null;
  firedAt: string;
}

export interface ActiveV2RuntimeDashboardReport {
  policyVersion: string;
  generatedAt: string;
  metrics: ActiveV2RuntimeMetricsSnapshot;
  manifestHealth: ActiveV2RuntimeManifestHealthSnapshot | null;
  alerts: ActiveV2RuntimeAlert[];
  hasCriticalAlert: boolean;
}
