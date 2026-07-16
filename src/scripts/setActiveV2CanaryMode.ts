import mongoose from 'mongoose';
import { readActiveV2CanaryConfig, writeActiveV2CanaryConfig } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigStore';
import { classifyActiveV2CanaryTransition } from '../services/competitive-data/runtime-control/ActiveV2CanaryTransitionPolicy';
import { appendActiveV2RuntimeControlChangelogEntry } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlChangelogWriter';
import type { ActiveV2CanaryConfig, ActiveV2CanaryMode } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigTypes';

const VALID_MODES: ActiveV2CanaryMode[] = ['off', 'shadow', 'internal', 'percentage', 'full'];

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/setActiveV2CanaryMode.ts --mode <off|shadow|internal|percentage|full> [--percentage <N>] --responsible <nome> --reason <texto> [--approver-two <nome>] [--executive-approver <nome>] [--new-canary-campaign-id <id>] [--new-seed <valor>]');
}

function formatCanaryState(config: Pick<ActiveV2CanaryConfig, 'mode' | 'percentage'>): string {
  return config.mode === 'percentage' ? `percentage:${config.percentage}` : config.mode;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const mode = getArg('--mode') as ActiveV2CanaryMode | undefined;
  const percentageRaw = getArg('--percentage');
  const responsible = getArg('--responsible');
  const reason = getArg('--reason');
  const approverTwo = getArg('--approver-two');
  const executiveApprover = getArg('--executive-approver');
  const newCanaryCampaignId = getArg('--new-canary-campaign-id');
  const newSeed = getArg('--new-seed');

  if (!mode || !VALID_MODES.includes(mode)) {
    console.error(`Erro: --mode deve ser um de: ${VALID_MODES.join(', ')}`);
    printUsage();
    process.exit(2);
    return;
  }

  let percentage: number | null = null;
  if (mode === 'percentage') {
    if (!percentageRaw) {
      console.error('Erro: --percentage e obrigatorio quando --mode=percentage.');
      process.exit(2);
      return;
    }
    percentage = Number(percentageRaw);
    if (Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
      console.error('Erro: --percentage deve ser um numero entre 0 e 100.');
      process.exit(2);
      return;
    }
  }

  if (!responsible || !reason) {
    console.error('Erro: --responsible e --reason sao obrigatorios.');
    printUsage();
    process.exit(2);
    return;
  }

  if ((newCanaryCampaignId && !newSeed) || (!newCanaryCampaignId && newSeed)) {
    console.error('Erro: --new-canary-campaign-id e --new-seed devem ser fornecidos juntos, ou nenhum dos dois.');
    process.exit(2);
    return;
  }

  const requirement = classifyActiveV2CanaryTransition(mode, percentage);

  if (requirement.requiredApproverCount === 2) {
    if (!approverTwo) {
      console.error(`Erro de Seguranca: esta transicao exige um segundo aprovador (--approver-two). ${requirement.description}`);
      process.exit(2);
      return;
    }
    if (approverTwo.trim().toLowerCase() === responsible.trim().toLowerCase()) {
      console.error('Erro de Seguranca: --responsible e --approver-two devem ser pessoas distintas (controle de quatro olhos).');
      process.exit(2);
      return;
    }
  }

  if (requirement.requiresExecutiveApproval) {
    if (!executiveApprover) {
      console.error(`Erro de Seguranca: esta transicao exige aprovacao executiva (--executive-approver). ${requirement.description}`);
      process.exit(2);
      return;
    }
    const distinctFromOthers = [responsible, approverTwo]
      .filter((name): name is string => !!name)
      .every(name => name.trim().toLowerCase() !== executiveApprover.trim().toLowerCase());
    if (!distinctFromOthers) {
      console.error('Erro de Seguranca: --executive-approver deve ser uma pessoa distinta de --responsible e --approver-two.');
      process.exit(2);
      return;
    }
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
    const current = await readActiveV2CanaryConfig(mongoose.connection);

    const nextCanaryCampaignId = newCanaryCampaignId ?? current.canaryCampaignId;
    const nextSeed = newSeed ?? current.seed;
    const isNewCampaign = nextCanaryCampaignId !== current.canaryCampaignId;
    const isConfigChange = current.mode !== mode || current.percentage !== percentage || isNewCampaign;
    const now = new Date().toISOString();

    const nextState: Omit<ActiveV2CanaryConfig, 'version'> = {
      mode,
      percentage,
      canaryCampaignId: nextCanaryCampaignId,
      seed: nextSeed,
      windowStartedAt: isConfigChange ? now : current.windowStartedAt,
      windowEndedAt: null,
    };

    const updated = await writeActiveV2CanaryConfig(mongoose.connection, current, nextState);

    const approvers = [approverTwo, executiveApprover].filter((name): name is string => !!name);

    appendActiveV2RuntimeControlChangelogEntry({
      timestampUtc: now,
      responsavel: responsible,
      aprovador: approvers.length > 0 ? approvers.join(', ') : null,
      valorAnterior: formatCanaryState(current),
      valorNovo: formatCanaryState(updated),
      motivo: reason,
      canaryCampaignId: nextCanaryCampaignId,
      publishRunId: null,
      resultado: 'success',
    });

    console.log('\n======================================================');
    console.log('  Active V2 Canary - Mudanca de Modo Aplicada  ');
    console.log('======================================================');
    console.log(`* Tier de aprovacao: [ ${requirement.tier} ]`);
    console.log(`* Estado anterior: ${formatCanaryState(current)}`);
    console.log(`* Estado novo: ${formatCanaryState(updated)}`);
    console.log(`* Campanha: ${nextCanaryCampaignId}${isNewCampaign ? ' (NOVA)' : ''}`);
    console.log(`* Janela reiniciada: ${isConfigChange ? 'SIM' : 'NAO'}`);
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Erro ao aplicar a transicao de canario:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
