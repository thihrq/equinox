import mongoose from 'mongoose';
import { readActiveV2RuntimeControl, writeActiveV2RuntimeControl } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlStore';
import { appendActiveV2RuntimeControlChangelogEntry } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlChangelogWriter';
import type { ActiveV2RuntimeControlTriggerSource } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlTypes';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/forceActiveV2Baseline.ts --operator <nome> --reason <texto> [--triggered-by manual|automatic] [--reason-code <CODIGO>] [--metrics-window-id <id>] [--canary-campaign-id <id>] [--publish-run-id <id>]');
  console.log('');
  console.log('  Acionamento do circuit breaker (adendo 4.2): execucao imediata, sem aprovacao previa.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const operator = getArg('--operator');
  const reason = getArg('--reason');
  const triggeredBy = (getArg('--triggered-by') ?? 'manual') as ActiveV2RuntimeControlTriggerSource;
  const reasonCode = getArg('--reason-code') ?? 'MANUAL_OPERATOR_TRIP';
  const metricsWindowId = getArg('--metrics-window-id') ?? null;
  const canaryCampaignId = getArg('--canary-campaign-id') ?? null;
  const publishRunId = getArg('--publish-run-id') ?? null;

  if (!operator || !reason) {
    console.error('Erro: --operator e --reason sao obrigatorios.');
    printUsage();
    process.exit(2);
    return;
  }

  if (triggeredBy !== 'manual' && triggeredBy !== 'automatic') {
    console.error('Erro: --triggered-by deve ser "manual" ou "automatic".');
    process.exit(2);
    return;
  }

  const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Erro de Configuracao: MONGO_URI ou MONGODB_URI e obrigatorio no ambiente.');
    process.exit(2);
    return;
  }

  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(3);
    return;
  }

  try {
    const current = await readActiveV2RuntimeControl(mongoose.connection);

    if (current.mode === 'force-baseline') {
      console.log('[Equinox] Circuit breaker ja esta em force-baseline. Nenhuma acao necessaria (idempotente).');
      process.exit(0);
      return;
    }

    const triggeredAt = new Date().toISOString();

    await writeActiveV2RuntimeControl(mongoose.connection, current.version, {
      mode: 'force-baseline',
      reasonCode,
      triggeredBy,
      triggeredAt,
      metricsWindowId,
      requiresManualRecovery: true,
    });

    appendActiveV2RuntimeControlChangelogEntry({
      timestampUtc: triggeredAt,
      responsavel: operator,
      aprovador: null,
      valorAnterior: current.mode,
      valorNovo: 'force-baseline',
      motivo: reason,
      canaryCampaignId,
      publishRunId,
      resultado: 'success',
    });

    console.log('\n======================================================');
    console.log('  Active V2 Circuit Breaker - FORCE BASELINE ACIONADO  ');
    console.log('======================================================');
    console.log(`* Reason Code: ${reasonCode}`);
    console.log(`* Triggered By: ${triggeredBy}`);
    console.log(`* Operador: ${operator}`);
    console.log(`* Requer recuperacao manual: SIM`);
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Erro ao acionar o circuit breaker:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
