import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { validateActiveV2RuntimeTelemetryEventShape } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetrySchema';
import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import { computeActiveV2RuntimeManifestHealth } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeManifestHealth';
import { evaluateActiveV2RuntimeAlerts } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeAlertEvaluator';
import { ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1 } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeObservabilityPolicy';
import {
  createActiveV2RuntimeObservabilityAuditContext,
  printActiveV2RuntimeObservabilityAuditHeader,
} from '../services/competitive-data/runtime-observability/ActiveV2RuntimeAuditLogger';
import {
  formatRuntimeDashboardReportAsJson,
  formatRuntimeDashboardReportAsMarkdown,
} from '../services/competitive-data/runtime-observability/ActiveV2RuntimeDashboardFormatter';
import { writeArtifactAtomically } from './support/writeActiveV2AcceptanceArtifacts';
import type {
  ActiveV2RuntimeDashboardReport,
  ActiveV2RuntimeManifestHealthSnapshot,
  ActiveV2RuntimeTelemetryEvent,
} from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/evaluateActiveV2RuntimeObservability.ts --input <eventos.json> [--output-json <path>] [--output-markdown <path>] [--with-manifest-health]');
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

  const inputPath = getArg('--input') ?? getArg('-i');
  const outputJsonPath = getArg('--output-json') ?? getArg('-j');
  const outputMarkdownPath = getArg('--output-markdown') ?? getArg('-m');
  const withManifestHealth = hasArg('--with-manifest-health');

  // 1. Argumentos CLI inválidos
  if (!inputPath) {
    console.error('Erro: O parametro obrigatorio --input nao foi informado.');
    printUsage();
    process.exit(2);
  }

  const resolvedInputPath = path.resolve(inputPath);

  // 2. Leitura física e tratamento de arquivo ausente / parse inválido
  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`Erro: O arquivo de entrada "${resolvedInputPath}" nao existe.`);
    process.exit(3);
  }

  let parsedEvents: unknown;
  try {
    const raw = fs.readFileSync(resolvedInputPath, 'utf8').replace(/^﻿/, '');
    parsedEvents = JSON.parse(raw);
  } catch (error) {
    console.error(`Erro no parse do JSON do arquivo de entrada:`, error);
    process.exit(3);
    return;
  }

  if (!Array.isArray(parsedEvents)) {
    console.error('Erro: O arquivo de entrada deve conter um array de eventos de telemetria.');
    process.exit(3);
    return;
  }

  // 3. Validação de schema dos eventos (falha de domínio, nao de leitura fisica)
  const schemaErrors: string[] = [];
  parsedEvents.forEach((raw, index) => {
    const result = validateActiveV2RuntimeTelemetryEventShape(raw);
    if (!result.valid) {
      schemaErrors.push(`Evento[${index}]: ${result.errors.join(' | ')}`);
    }
  });

  if (schemaErrors.length > 0) {
    console.error('[Equinox] Um ou mais eventos de telemetria sao invalidos:');
    schemaErrors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
    return;
  }

  const events = parsedEvents as ActiveV2RuntimeTelemetryEvent[];
  const { windowStartedAt, windowEndedAt } = deriveWindowBounds(events);

  // 4. Saúde do manifesto (opcional, exige MONGO_URI)
  let manifestHealth: ActiveV2RuntimeManifestHealthSnapshot | null = null;
  if (withManifestHealth) {
    const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Erro de Configuracao: --with-manifest-health exige MONGO_URI ou MONGODB_URI no ambiente.');
      process.exit(2);
      return;
    }

    try {
      await mongoose.connect(mongoUri);
      manifestHealth = await computeActiveV2RuntimeManifestHealth(mongoose.connection);
    } catch (error) {
      console.error('Erro ao calcular a saude do manifesto:', error);
      process.exit(3);
      return;
    } finally {
      await mongoose.disconnect();
    }
  }

  // 5. Agregação e avaliação
  const metrics = aggregateActiveV2RuntimeMetrics(events, windowStartedAt, windowEndedAt);
  const alerts = evaluateActiveV2RuntimeAlerts(metrics, manifestHealth, ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1);

  const report: ActiveV2RuntimeDashboardReport = {
    policyVersion: ACTIVE_V2_RUNTIME_OBSERVABILITY_POLICY_V1.version,
    generatedAt: new Date().toISOString(),
    metrics,
    manifestHealth,
    alerts,
    hasCriticalAlert: alerts.some(a => a.severity === 'critical'),
  };

  // 6. Formatar e escrever artefatos
  const formattedJson = formatRuntimeDashboardReportAsJson(report);
  const formattedMarkdown = formatRuntimeDashboardReportAsMarkdown(report);

  if (outputJsonPath) {
    try {
      writeArtifactAtomically(outputJsonPath, formattedJson);
      console.log(`[Equinox] Relatorio JSON escrito com sucesso em: ${path.resolve(outputJsonPath)}`);
    } catch (error) {
      console.error(`Erro ao gravar relatorio JSON em "${outputJsonPath}":`, error);
      process.exit(1);
      return;
    }
  }

  if (outputMarkdownPath) {
    try {
      writeArtifactAtomically(outputMarkdownPath, formattedMarkdown);
      console.log(`[Equinox] Relatorio Markdown escrito com sucesso em: ${path.resolve(outputMarkdownPath)}`);
    } catch (error) {
      console.error(`Erro ao gravar relatorio Markdown em "${outputMarkdownPath}":`, error);
      process.exit(1);
      return;
    }
  }

  // 7. Auditoria e resumo em console
  const auditContext = createActiveV2RuntimeObservabilityAuditContext(
    'evaluateActiveV2RuntimeObservability',
    windowStartedAt,
    windowEndedAt
  );
  printActiveV2RuntimeObservabilityAuditHeader(auditContext, report);

  console.log('\n======================================================');
  console.log('  Active V2 Runtime Observability - Resumo da Janela  ');
  console.log('======================================================');
  console.log(`* Alertas disparados: [ ${alerts.length} ]`);
  console.log(`* Alerta critico presente: [ ${report.hasCriticalAlert ? 'SIM' : 'NAO'} ]`);
  console.log('======================================================\n');

  // 8. Exit code
  process.exit(report.hasCriticalAlert ? 1 : 0);
}

main().catch(error => {
  console.error('Erro inesperado:', error);
  process.exit(1);
});
