import mongoose from 'mongoose';
import { readActiveV2RuntimeControl, writeActiveV2RuntimeControl } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlStore';
import { appendActiveV2RuntimeControlChangelogEntry } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlChangelogWriter';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/reactivateActiveV2CircuitBreaker.ts --approver-one <nome> --approver-two <nome> --reason <texto> [--canary-campaign-id <id>] [--publish-run-id <id>]');
  console.log('');
  console.log('  Retirar FORCE_BASELINE (adendo 4.2): exige aprovacao de duas pessoas distintas.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const approverOne = getArg('--approver-one');
  const approverTwo = getArg('--approver-two');
  const reason = getArg('--reason');
  const canaryCampaignId = getArg('--canary-campaign-id') ?? null;
  const publishRunId = getArg('--publish-run-id') ?? null;

  if (!approverOne || !approverTwo || !reason) {
    console.error('Erro: --approver-one, --approver-two e --reason sao obrigatorios.');
    printUsage();
    process.exit(2);
    return;
  }

  if (approverOne.trim().toLowerCase() === approverTwo.trim().toLowerCase()) {
    console.error('Erro de Seguranca: --approver-one e --approver-two devem ser pessoas distintas (controle de quatro olhos).');
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

    if (current.mode !== 'force-baseline') {
      console.error('[Equinox] O circuit breaker nao esta em force-baseline. Nao ha nada para reativar.');
      process.exit(1);
      return;
    }

    const reactivatedAt = new Date().toISOString();

    await writeActiveV2RuntimeControl(mongoose.connection, current.version, {
      mode: 'normal',
      reasonCode: null,
      triggeredBy: null,
      triggeredAt: null,
      metricsWindowId: null,
      requiresManualRecovery: false,
    });

    appendActiveV2RuntimeControlChangelogEntry({
      timestampUtc: reactivatedAt,
      responsavel: `${approverOne} + ${approverTwo}`,
      aprovador: `${approverOne}, ${approverTwo}`,
      valorAnterior: current.mode,
      valorNovo: 'normal',
      motivo: reason,
      canaryCampaignId,
      publishRunId,
      resultado: 'success',
    });

    console.log('\n======================================================');
    console.log('  Active V2 Circuit Breaker - REATIVADO (mode=normal)  ');
    console.log('======================================================');
    console.log(`* Aprovador 1: ${approverOne}`);
    console.log(`* Aprovador 2: ${approverTwo}`);
    console.log(`* Motivo: ${reason}`);
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Erro ao reativar o circuit breaker:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
