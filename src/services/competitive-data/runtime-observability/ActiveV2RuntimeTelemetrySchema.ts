import type { ActiveV2RuntimeTelemetryEvent } from './ActiveV2RuntimeTelemetryTypes';

const V2_OUTCOMES = new Set(['success', 'error', 'timeout', 'skipped']);
const BASELINE_OUTCOMES = new Set(['success', 'error']);
const FALLBACK_REASONS = new Set([
  'v2-error',
  'v2-timeout',
  'v2-disabled',
  'circuit-breaker',
  'force-baseline',
  'digest-mismatch',
  // 'no-v2-data' faltava aqui (bug real: todo evento de shadow com
  // fallbackTriggered=true e' emitido com essa razao, mas essa lista
  // rejeitava o proprio evento que o orquestrador real produz).
  'no-v2-data',
  'ambiguous-v2-data',
  'unknown',
]);
const CLASSIFICATIONS = new Set([
  'blocker',
  'regression',
  'human-review-needed',
  'improvement',
  'acceptable-divergence',
  'equivalent',
]);

export interface TelemetrySchemaValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0;
}

/**
 * Valida a forma de um evento de telemetria bruto (ex: vindo de um JSON externo
 * ou de uma requisição de runtime) antes de ele entrar no agregador de métricas.
 * Não lança exceção — retorna a lista de violações para o chamador decidir o
 * que fazer (descartar o evento, rejeitar o lote, etc.).
 */
export function validateActiveV2RuntimeTelemetryEventShape(raw: unknown): TelemetrySchemaValidationResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['TELEMETRY_SCHEMA_INVALID: evento não é um objeto'] };
  }

  const event = raw as Record<string, any>;

  if (!isNonEmptyString(event.eventId)) errors.push('TELEMETRY_SCHEMA_INVALID: eventId ausente ou inválido');
  if (!isNonEmptyString(event.occurredAt) || Number.isNaN(Date.parse(event.occurredAt))) {
    errors.push('TELEMETRY_SCHEMA_INVALID: occurredAt ausente ou não é uma data ISO válida');
  }
  if (!isNonEmptyString(event.requestId)) errors.push('TELEMETRY_SCHEMA_INVALID: requestId ausente ou inválido');
  if (!isNonEmptyString(event.format)) errors.push('TELEMETRY_SCHEMA_INVALID: format ausente ou inválido');
  if (!isNonEmptyString(event.teamIdentity)) errors.push('TELEMETRY_SCHEMA_INVALID: teamIdentity ausente ou inválido');
  if (!isNonEmptyString(event.archetype)) errors.push('TELEMETRY_SCHEMA_INVALID: archetype ausente ou inválido');

  if (event.publishRunId !== null && !isNonEmptyString(event.publishRunId)) {
    errors.push('TELEMETRY_SCHEMA_INVALID: publishRunId deve ser string não-vazia ou null');
  }
  if (event.activeV2DataDigest !== null && !isNonEmptyString(event.activeV2DataDigest)) {
    errors.push('TELEMETRY_SCHEMA_INVALID: activeV2DataDigest deve ser string não-vazia ou null');
  }

  if (typeof event.baseline !== 'object' || event.baseline === null) {
    errors.push('TELEMETRY_SCHEMA_INVALID: baseline ausente');
  } else {
    if (!BASELINE_OUTCOMES.has(event.baseline.outcome)) {
      errors.push('TELEMETRY_SCHEMA_INVALID: baseline.outcome inválido');
    }
    if (typeof event.baseline.latencyMs !== 'number' || event.baseline.latencyMs < 0) {
      errors.push('TELEMETRY_SCHEMA_INVALID: baseline.latencyMs inválido');
    }
  }

  if (typeof event.v2 !== 'object' || event.v2 === null) {
    errors.push('TELEMETRY_SCHEMA_INVALID: v2 ausente');
  } else {
    if (!V2_OUTCOMES.has(event.v2.outcome)) {
      errors.push('TELEMETRY_SCHEMA_INVALID: v2.outcome inválido');
    }
    if (event.v2.latencyMs !== null && (typeof event.v2.latencyMs !== 'number' || event.v2.latencyMs < 0)) {
      errors.push('TELEMETRY_SCHEMA_INVALID: v2.latencyMs deve ser número não-negativo ou null');
    }
    if (typeof event.v2.fallbackTriggered !== 'boolean') {
      errors.push('TELEMETRY_SCHEMA_INVALID: v2.fallbackTriggered ausente ou inválido');
    }
    if (event.v2.fallbackReason !== null && !FALLBACK_REASONS.has(event.v2.fallbackReason)) {
      errors.push('TELEMETRY_SCHEMA_INVALID: v2.fallbackReason inválido');
    }
    if (event.v2.fallbackTriggered === true && event.v2.fallbackReason === null) {
      errors.push('TELEMETRY_SCHEMA_INVALID: v2.fallbackTriggered=true exige v2.fallbackReason preenchido');
    }
  }

  if (event.comparison !== null) {
    if (typeof event.comparison !== 'object') {
      errors.push('TELEMETRY_SCHEMA_INVALID: comparison deve ser objeto ou null');
    } else {
      if (!CLASSIFICATIONS.has(event.comparison.classification)) {
        errors.push('TELEMETRY_SCHEMA_INVALID: comparison.classification inválido');
      }
      if (event.comparison.scoreDelta !== null && typeof event.comparison.scoreDelta !== 'number') {
        errors.push('TELEMETRY_SCHEMA_INVALID: comparison.scoreDelta deve ser número ou null');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida e retorna o evento tipado. Lança se a forma for inválida — usado nos
 * pontos de entrada (ingest de runtime, leitura de fixture) onde um evento
 * malformado deve interromper o processamento em vez de ser silenciosamente
 * ignorado.
 */
export function parseActiveV2RuntimeTelemetryEvent(raw: unknown): ActiveV2RuntimeTelemetryEvent {
  const result = validateActiveV2RuntimeTelemetryEventShape(raw);
  if (!result.valid) {
    throw new Error(`TELEMETRY_SCHEMA_INVALID: ${result.errors.join(' | ')}`);
  }
  return raw as ActiveV2RuntimeTelemetryEvent;
}
