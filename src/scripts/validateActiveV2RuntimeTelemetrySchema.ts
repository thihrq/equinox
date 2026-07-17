import { validateActiveV2RuntimeTelemetryEventShape, parseActiveV2RuntimeTelemetryEvent } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetrySchema';

const VALID_EVENT = {
  eventId: 'evt-1',
  occurredAt: '2026-07-15T12:00:00.000Z',
  requestId: 'req-1',
  format: 'champions_reg_m_b_doubles',
  teamIdentity: 'balanced',
  archetype: 'balanced-offense',
  publishRunId: 'publish-run-1',
  activeV2DataDigest: 'sha256-abc',
  baseline: { outcome: 'success', latencyMs: 100 },
  v2: { outcome: 'success', latencyMs: 110, fallbackTriggered: false, fallbackReason: null },
  comparison: { classification: 'equivalent', scoreDelta: 0 },
};

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: evento válido passa ---
  const result1 = validateActiveV2RuntimeTelemetryEventShape(VALID_EVENT);
  if (!result1.valid) throw new Error(`Test 1 failed: expected valid event to pass, got errors: ${result1.errors.join(', ')}`);

  // --- Caso de Teste 2: evento válido com campos null permitidos ---
  const nullableEvent = { ...VALID_EVENT, publishRunId: null, activeV2DataDigest: null, comparison: null };
  const result2 = validateActiveV2RuntimeTelemetryEventShape(nullableEvent);
  if (!result2.valid) throw new Error(`Test 2 failed: expected event with nullable fields to pass, got errors: ${result2.errors.join(', ')}`);

  // --- Caso de Teste 3: objeto não é um evento ---
  const result3 = validateActiveV2RuntimeTelemetryEventShape(null);
  if (result3.valid) throw new Error('Test 3 failed: expected null to be invalid');

  // --- Caso de Teste 4: eventId ausente ---
  const missingEventId = { ...VALID_EVENT, eventId: undefined };
  const result4 = validateActiveV2RuntimeTelemetryEventShape(missingEventId);
  if (result4.valid || !result4.errors.some(e => e.includes('eventId'))) {
    throw new Error('Test 4 failed: expected missing eventId to be flagged');
  }

  // --- Caso de Teste 5: baseline.outcome inválido ---
  const badOutcome = { ...VALID_EVENT, baseline: { outcome: 'maybe', latencyMs: 100 } };
  const result5 = validateActiveV2RuntimeTelemetryEventShape(badOutcome);
  if (result5.valid || !result5.errors.some(e => e.includes('baseline.outcome'))) {
    throw new Error('Test 5 failed: expected invalid baseline.outcome to be flagged');
  }

  // --- Caso de Teste 6: fallbackTriggered=true sem fallbackReason ---
  const badFallback = {
    ...VALID_EVENT,
    v2: { outcome: 'error', latencyMs: 200, fallbackTriggered: true, fallbackReason: null },
  };
  const result6 = validateActiveV2RuntimeTelemetryEventShape(badFallback);
  if (result6.valid || !result6.errors.some(e => e.includes('fallbackReason'))) {
    throw new Error('Test 6 failed: expected fallbackTriggered without fallbackReason to be flagged');
  }

  // --- Caso de Teste 7: comparison.classification inválido ---
  const badClassification = { ...VALID_EVENT, comparison: { classification: 'unknown-thing', scoreDelta: 0 } };
  const result7 = validateActiveV2RuntimeTelemetryEventShape(badClassification);
  if (result7.valid || !result7.errors.some(e => e.includes('comparison.classification'))) {
    throw new Error('Test 7 failed: expected invalid comparison.classification to be flagged');
  }

  // --- Caso de Teste 8: parseActiveV2RuntimeTelemetryEvent lança em evento inválido ---
  try {
    parseActiveV2RuntimeTelemetryEvent(null);
    throw new Error('Test 8 failed: expected parse to throw on invalid event');
  } catch (error: any) {
    if (!error.message.includes('TELEMETRY_SCHEMA_INVALID')) throw error;
  }

  // --- Caso de Teste 9: parseActiveV2RuntimeTelemetryEvent retorna evento válido tipado ---
  const parsed = parseActiveV2RuntimeTelemetryEvent(VALID_EVENT);
  if (parsed.eventId !== 'evt-1') throw new Error('Test 9 failed: expected parsed event to preserve eventId');

  // --- Caso de Teste 10: fallbackReason='no-v2-data' e' aceito (bug real corrigido —
  // esse valor faltava na allowlist e rejeitava exatamente o evento que o
  // orquestrador de shadow real emite quando um Pokemon nao tem set V2) ---
  const noV2DataEvent = {
    ...VALID_EVENT,
    v2: { outcome: 'skipped', latencyMs: null, fallbackTriggered: true, fallbackReason: 'no-v2-data' },
  };
  const result10 = validateActiveV2RuntimeTelemetryEventShape(noV2DataEvent);
  if (!result10.valid) throw new Error(`Test 10 failed: expected fallbackReason='no-v2-data' to be accepted, got: ${result10.errors.join(', ')}`);

  // --- Caso de Teste 11: fallbackReason='ambiguous-v2-data' e' aceito ---
  const ambiguousEvent = {
    ...VALID_EVENT,
    v2: { outcome: 'skipped', latencyMs: null, fallbackTriggered: true, fallbackReason: 'ambiguous-v2-data' },
  };
  const result11 = validateActiveV2RuntimeTelemetryEventShape(ambiguousEvent);
  if (!result11.valid) throw new Error(`Test 11 failed: expected fallbackReason='ambiguous-v2-data' to be accepted, got: ${result11.errors.join(', ')}`);

  console.log('[Equinox] Active V2 runtime telemetry schema validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
