import * as fs from 'fs';
import * as path from 'path';
import { validateActiveV2RuntimeTelemetryEventShape } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetrySchema';
import { aggregateActiveV2RuntimeMetrics } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeMetricsAggregator';
import { projectActiveV2MongoOperationsCost, type ActiveV2CostProjectionTrafficBasis } from '../services/competitive-data/rollout-governance/ActiveV2CostProjectionEngine';
import { ACTIVE_V2_SHADOW_MONGO_IO_PROFILE_V1 } from '../services/competitive-data/rollout-governance/ActiveV2CostProjectionPolicy';
import { writeArtifactAtomically } from './support/writeActiveV2AcceptanceArtifacts';
import type { ActiveV2RuntimeTelemetryEvent } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeTelemetryTypes';

function printUsage(): void {
  console.log('Uso:');
  console.log(
    '  ts-node src/scripts/evaluateActiveV2CostProjection.ts --events <eventos.json> --traffic-basis <shadow|percentage> [--current-percentage <n>] [--suggested-team-size <n>] [--cost-per-thousand-reads <n> --cost-per-thousand-writes <n> --currency <codigo>] [--output-json <path>]'
  );
  console.log('');
  console.log('Nota: cobre apenas operacoes Mongo do caminho de shadow (Fase 3), o unico com codigo de runtime real hoje.');
  console.log('CPU, memoria, logs e billing de Render nao sao cobertos — exigem acesso real a infraestrutura.');
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

  const eventsPath = getArg('--events') ?? getArg('-e');
  const trafficBasisArg = getArg('--traffic-basis');
  const currentPercentageArg = getArg('--current-percentage');
  const suggestedTeamSizeArg = getArg('--suggested-team-size');
  const costReadsArg = getArg('--cost-per-thousand-reads');
  const costWritesArg = getArg('--cost-per-thousand-writes');
  const currencyArg = getArg('--currency');
  const outputJsonPath = getArg('--output-json') ?? getArg('-j');

  if (!eventsPath || (trafficBasisArg !== 'shadow' && trafficBasisArg !== 'percentage')) {
    console.error('Erro: --events e --traffic-basis <shadow|percentage> sao obrigatorios.');
    printUsage();
    process.exit(2);
    return;
  }

  let trafficBasis: ActiveV2CostProjectionTrafficBasis;
  if (trafficBasisArg === 'shadow') {
    trafficBasis = { kind: 'shadow-full-traffic' };
  } else {
    const currentPercentage = currentPercentageArg !== undefined ? Number(currentPercentageArg) : NaN;
    if (Number.isNaN(currentPercentage)) {
      console.error('Erro: --current-percentage e obrigatorio e numerico quando --traffic-basis=percentage.');
      printUsage();
      process.exit(2);
      return;
    }
    trafficBasis = { kind: 'percentage', currentPercentage };
  }

  const costFlagsPresent = [costReadsArg, costWritesArg, currencyArg];
  const someCostFlagPresent = costFlagsPresent.some(v => v !== undefined);
  const allCostFlagsPresent = costFlagsPresent.every(v => v !== undefined);
  if (someCostFlagPresent && !allCostFlagsPresent) {
    console.error('Erro: --cost-per-thousand-reads, --cost-per-thousand-writes e --currency devem ser informados juntos, ou nenhum deles.');
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
  // Todo evento de telemetria persistido ja passou pelo ciclo completo de
  // leitura/escrita do orquestrador (requisicoes que retornam cedo por
  // formato/flag/modo/breaker nunca chegam a gravar um evento) — o total de
  // eventos agregados e' exatamente o numero de requisicoes avaliadas.
  const metrics = aggregateActiveV2RuntimeMetrics(events, windowStartedAt, windowEndedAt);

  let result;
  try {
    result = projectActiveV2MongoOperationsCost({
      windowStartedAt,
      windowEndedAt,
      evaluatedRequestCount: metrics.requestCount,
      trafficBasis,
      ioProfile: ACTIVE_V2_SHADOW_MONGO_IO_PROFILE_V1,
      suggestedTeamSize: suggestedTeamSizeArg !== undefined ? Number(suggestedTeamSizeArg) : undefined,
      costRates: allCostFlagsPresent
        ? {
            costPerThousandReads: Number(costReadsArg),
            costPerThousandWrites: Number(costWritesArg),
            currency: currencyArg as string,
          }
        : undefined,
    });
  } catch (error) {
    console.error('Erro de dominio ao projetar custo:', error instanceof Error ? error.message : error);
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
  console.log('  Active V2 Cost Projection (operacoes Mongo) - Resultado  ');
  console.log('======================================================');
  console.log('* ATENCAO: cobre apenas operacoes Mongo do caminho de shadow (Fase 3).');
  console.log('*          CPU, memoria, logs e billing de Render NAO sao cobertos.');
  console.log(`* Requisicoes avaliadas na janela: ${result.observedEvaluatedRequestCount}`);
  console.log(`* Trafego elegivel total estimado na janela: ${result.estimatedFullEligibleTrafficForWindow.toFixed(1)}`);
  console.log(`* Leituras/escrita por requisicao: ${result.readsPerEvaluatedRequest} leituras / ${result.writesPerEvaluatedRequest} escrita(s)`);
  if (result.costPerThousandRequests) {
    console.log(`* Custo por mil requisicoes: ${result.costPerThousandRequests.amount.toFixed(4)} ${result.costPerThousandRequests.currency}`);
  } else {
    console.log('* Custo por mil requisicoes: n/a (nenhuma tarifa real informada — ver --cost-per-thousand-reads/writes)');
  }
  console.log('\nProjecao por percentual de canario:');
  for (const p of result.projections) {
    const costStr = p.estimatedCost ? `${p.estimatedCost.amount.toFixed(4)} ${p.estimatedCost.currency}` : 'n/a';
    console.log(
      `  - ${p.targetPercentage}%: ${p.projectedEvaluatedRequests.toFixed(1)} req -> ${p.projectedMongoReads.toFixed(0)} leituras / ${p.projectedMongoWrites.toFixed(0)} escritas / custo ${costStr}`
    );
  }
  console.log('======================================================\n');

  process.exit(0);
}

main().catch(error => {
  console.error('Erro inesperado:', error);
  process.exit(1);
});
