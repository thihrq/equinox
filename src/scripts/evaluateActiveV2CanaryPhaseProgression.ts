import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { validateActiveV2RuntimeTelemetryEventShape } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetrySchema';
import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import { computeActiveV2RuntimeManifestHealth } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeManifestHealth';
import { evaluateActiveV2RuntimeAlerts } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeAlertEvaluator';
import { ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1 } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeObservabilityPolicy';
import { evaluateActiveV2CanaryPhaseProgression } from '../services/competitive-data/rollout-governance/ActiveV2CanaryPhaseProgressionGate';
import { readActiveV2CanaryConfig } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigStore';
import { readActiveV2RuntimeControl } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlStore';
import { writeArtifactAtomically } from './support/writeActiveV2AcceptanceArtifacts';
import type { ActiveV2CanaryMode } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigTypes';
import type { ActiveV2RuntimeControlMode } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlTypes';
import type { ActiveV2RuntimeManifestHealthSnapshot, ActiveV2RuntimeTelemetryEvent } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

const VALID_MODES: ActiveV2CanaryMode[] = ['off', 'shadow', 'internal', 'percentage', 'full'];

function printUsage(): void {
  console.log('Uso (modo offline, sem Mongo):');
  console.log(
    '  ts-node src/scripts/evaluateActiveV2CanaryPhaseProgression.ts --events <eventos.json> --phase-mode <off|shadow|internal|percentage|full> [--phase-percentage <n>] --phase-window-started-at <iso> [--circuit-breaker-mode <normal|force-baseline>] [--output-json <path>]'
  );
  console.log('Uso (modo live, le a fase/breaker reais do Mongo via MONGO_URI):');
  console.log('  ts-node src/scripts/evaluateActiveV2CanaryPhaseProgression.ts --events <eventos.json> --live [--output-json <path>]');
}

function deriveWindowBounds(events: ActiveV2RuntimeTelemetryEvent[]): { windowStartedAt: string; windowEndedAt: string } {
  if (events.length === 0) {
    const now = new Date().toISOString();
    return { windowStartedAt: now, windowEndedAt: now };
  }
  const timestamps = events.map(e => Date.parse(e.occurredAt)).sort((a, b) => a - b);
  return {
    windowStartedAt: new Date(timestamps[0]).toISOString(),
    windowEndedAt: new Date(timestamps[timestamps.length - 1]).toISOString(),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const hasArg = (flag: string): boolean => args.includes(flag);

  const eventsPath = getArg('--events') ?? getArg('-e');
  const outputJsonPath = getArg('--output-json') ?? getArg('-j');
  const live = hasArg('--live');

  if (!eventsPath) {
    console.error('Erro: O parametro obrigatorio --events nao foi informado.');
    printUsage();
    process.exit(2);
    return;
  }

  const resolvedEventsPath = path.resolve(eventsPath);
  if (!fs.existsSync(resolvedEventsPath)) {
    console.error(`Erro: O arquivo de eventos "${resolvedEventsPath}" nao existe.`);
    process.exit(3);
    return;
  }

  let parsedEvents: unknown;
  try {
    const raw = fs.readFileSync(resolvedEventsPath, 'utf8').replace(/^﻿/, '');
    parsedEvents = JSON.parse(raw);
  } catch (error) {
    console.error('Erro no parse do JSON do arquivo de eventos:', error);
    process.exit(3);
    return;
  }

  if (!Array.isArray(parsedEvents)) {
    console.error('Erro: O arquivo de eventos deve conter um array de eventos de telemetria.');
    process.exit(3);
    return;
  }

  const schemaErrors: string[] = [];
  parsedEvents.forEach((raw, index) => {
    const result = validateActiveV2RuntimeTelemetryEventShape(raw);
    if (!result.valid) schemaErrors.push(`Evento[${index}]: ${result.errors.join(' | ')}`);
  });
  if (schemaErrors.length > 0) {
    console.error('[Equinox] Um ou mais eventos de telemetria sao invalidos:');
    schemaErrors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
    return;
  }

  const events = parsedEvents as ActiveV2RuntimeTelemetryEvent[];
  const { windowStartedAt, windowEndedAt } = deriveWindowBounds(events);

  let phaseMode: ActiveV2CanaryMode;
  let phasePercentage: number | null;
  let phaseWindowStartedAt: string;
  let circuitBreakerMode: ActiveV2RuntimeControlMode;
  let manifestHealth: ActiveV2RuntimeManifestHealthSnapshot | null = null;

  if (live) {
    const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Erro de Configuracao: --live exige MONGO_URI ou MONGODB_URI no ambiente.');
      process.exit(2);
      return;
    }
    try {
      await mongoose.connect(mongoUri);
      const canaryConfig = await readActiveV2CanaryConfig(mongoose.connection);
      const breakerState = await readActiveV2RuntimeControl(mongoose.connection);
      manifestHealth = await computeActiveV2RuntimeManifestHealth(mongoose.connection);
      phaseMode = canaryConfig.mode;
      phasePercentage = canaryConfig.percentage;
      phaseWindowStartedAt = canaryConfig.windowStartedAt;
      circuitBreakerMode = breakerState.mode;
    } catch (error) {
      console.error('Erro ao ler estado real do canario/breaker no Mongo:', error);
      process.exit(3);
      return;
    } finally {
      await mongoose.disconnect();
    }
  } else {
    const rawMode = getArg('--phase-mode');
    const rawPercentage = getArg('--phase-percentage');
    const rawWindowStartedAt = getArg('--phase-window-started-at');
    const rawBreakerMode = getArg('--circuit-breaker-mode') ?? 'normal';

    if (!rawMode || !VALID_MODES.includes(rawMode as ActiveV2CanaryMode)) {
      console.error(`Erro: --phase-mode e obrigatorio e deve ser um de: ${VALID_MODES.join(', ')}`);
      printUsage();
      process.exit(2);
      return;
    }
    if (!rawWindowStartedAt || Number.isNaN(Date.parse(rawWindowStartedAt))) {
      console.error('Erro: --phase-window-started-at e obrigatorio e deve ser uma data ISO valida.');
      printUsage();
      process.exit(2);
      return;
    }
    if (rawBreakerMode !== 'normal' && rawBreakerMode !== 'force-baseline') {
      console.error('Erro: --circuit-breaker-mode deve ser "normal" ou "force-baseline".');
      process.exit(2);
      return;
    }

    phaseMode = rawMode as ActiveV2CanaryMode;
    phasePercentage = rawPercentage !== undefined ? Number(rawPercentage) : null;
    phaseWindowStartedAt = rawWindowStartedAt;
    circuitBreakerMode = rawBreakerMode as ActiveV2RuntimeControlMode;
  }

  const metrics = aggregateActiveV2RuntimeMetrics(events, windowStartedAt, windowEndedAt);
  const alerts = evaluateActiveV2RuntimeAlerts(metrics, manifestHealth, ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1);

  let result;
  try {
    result = evaluateActiveV2CanaryPhaseProgression({
      currentPhase: { mode: phaseMode, percentage: phasePercentage },
      phaseWindowStartedAt,
      metrics,
      alerts,
      circuitBreakerMode,
    });
  } catch (error) {
    console.error('Erro de dominio ao avaliar a progressao:', error instanceof Error ? error.message : error);
    process.exit(1);
    return;
  }

  if (outputJsonPath) {
    try {
      writeArtifactAtomically(outputJsonPath, JSON.stringify(result, null, 2));
      console.log(`[Equinox] Relatorio JSON escrito com sucesso em: ${path.resolve(outputJsonPath)}`);
    } catch (error) {
      console.error(`Erro ao gravar relatorio JSON em "${outputJsonPath}":`, error);
      process.exit(1);
      return;
    }
  }

  console.log('\n======================================================');
  console.log('  Active V2 Canary Phase Progression - Resultado  ');
  console.log('======================================================');
  console.log(`* Fase: [ ${result.phaseLabel} ]`);
  console.log(`* Decisao: [ ${result.decision.toUpperCase()} ]`);
  console.log(`* Dias em observacao: ${result.elapsedObservationDays.toFixed(1)}/${result.minObservationDays}`);
  console.log(`* Execucoes validas: ${result.validExecutions}/${result.minValidExecutions}`);
  console.log(`* Circuit breaker disparado: ${result.circuitBreakerTripped ? 'SIM' : 'NAO'}`);
  console.log(`* Alertas criticos: ${result.criticalAlertCodes.length > 0 ? result.criticalAlertCodes.join(', ') : 'nenhum'}`);
  if (result.decision === 'hold') {
    console.log(`* Hold expirado (> ${result.maxHoldDurationDays}d, exige revisao humana): ${result.holdExpired ? 'SIM' : 'NAO'}`);
  }
  if (result.decision === 'advance' && result.nextPhase) {
    const nextLabel = result.nextPhase.percentage === null ? result.nextPhase.mode : `${result.nextPhase.mode}:${result.nextPhase.percentage}`;
    console.log(`* Proxima fase recomendada: ${nextLabel}`);
  }
  result.reasons.forEach(reason => console.log(`  - ${reason}`));
  console.log('======================================================\n');

  if (result.decision === 'advance') process.exit(0);
  if (result.decision === 'hold') process.exit(4);
  process.exit(1); // rollback
}

main().catch(error => {
  console.error('Erro inesperado:', error);
  process.exit(1);
});
