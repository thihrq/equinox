import { runActiveV2RuntimeSyntheticInjectionGate } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeSyntheticInjectionGate';

const EXPECTED_ALERT_CODES = [
  'V2_ERROR_RATE',
  'V2_TIMEOUT_RATE',
  'FALLBACK_RATE',
  'P95_LATENCY_DEGRADATION',
  'BLOCKER_CLASSIFICATION_PRESENT',
  'ZERO_ACTIVE_SETS',
  'MULTIPLE_ACTIVE_VERSIONS',
  'MANIFEST_INCONSISTENCY',
  'DIGEST_MISMATCH',
];

async function runTests(): Promise<void> {
  const report = runActiveV2RuntimeSyntheticInjectionGate();

  // --- Caso de Teste 1: os 9 alertas mínimos do adendo 3.1 estão cobertos ---
  const coveredCodes = report.scenarios.map(s => s.alertCode).sort();
  const expectedSorted = [...EXPECTED_ALERT_CODES].sort();
  if (coveredCodes.join(',') !== expectedSorted.join(',')) {
    throw new Error(`Test 1 failed: expected all 9 minimum alerts to be covered, got: ${coveredCodes.join(',')}`);
  }

  // --- Caso de Teste 2: todos os cenários dispararam o alerta esperado ---
  const notFired = report.scenarios.filter(s => !s.fired);
  if (notFired.length > 0) {
    throw new Error(`Test 2 failed: expected all scenarios to fire, but these did not: ${notFired.map(s => s.alertCode).join(',')}`);
  }
  if (!report.allFired) throw new Error('Test 2 failed: expected report.allFired to be true');

  // --- Caso de Teste 3: todos os cenários dispararam dentro do SLA ---
  const outsideSla = report.scenarios.filter(s => !s.withinSla);
  if (outsideSla.length > 0) {
    throw new Error(`Test 3 failed: expected all scenarios within SLA, but these were not: ${outsideSla.map(s => s.alertCode).join(',')}`);
  }
  if (!report.allWithinSla) throw new Error('Test 3 failed: expected report.allWithinSla to be true');

  // --- Caso de Teste 4: gate final aprovado ---
  if (!report.gatePassed) throw new Error('Test 4 failed: expected report.gatePassed to be true');

  // --- Caso de Teste 5: relatório declara a limitação de escopo (offline vs staging real) ---
  if (!report.limitation || report.limitation.length === 0) {
    throw new Error('Test 5 failed: expected report.limitation to be a non-empty disclosure string');
  }

  console.log('[Equinox] Active V2 runtime synthetic injection gate validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
