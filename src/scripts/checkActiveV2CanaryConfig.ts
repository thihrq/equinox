import mongoose from 'mongoose';
import { readActiveV2CanaryConfig } from '../services/competitive-data/runtime-control/ActiveV2CanaryConfigStore';

async function main(): Promise<void> {
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
    const config = await readActiveV2CanaryConfig(mongoose.connection);

    console.log('\n======================================================');
    console.log('  Active V2 Canary - Configuracao Atual  ');
    console.log('======================================================');
    console.log(`* Modo: [ ${config.mode.toUpperCase()} ]`);
    console.log(`* Percentual: ${config.percentage ?? 'n/a'}`);
    console.log(`* Campanha: ${config.canaryCampaignId}`);
    console.log(`* Seed: ${config.seed}`);
    console.log(`* Janela iniciada em: ${config.windowStartedAt}`);
    console.log(`* Versao da config: ${config.version}`);
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Erro ao ler a configuracao de canario:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
