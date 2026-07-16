import mongoose from 'mongoose';
import { readActiveV2RuntimeControl } from '../services/competitive-data/runtime-control/ActiveV2RuntimeControlStore';

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
    const state = await readActiveV2RuntimeControl(mongoose.connection);

    console.log('\n======================================================');
    console.log('  Active V2 Circuit Breaker - Status  ');
    console.log('======================================================');
    console.log(`* Modo: [ ${state.mode.toUpperCase()} ]`);
    console.log(`* Reason Code: ${state.reasonCode ?? 'n/a'}`);
    console.log(`* Triggered By: ${state.triggeredBy ?? 'n/a'}`);
    console.log(`* Triggered At: ${state.triggeredAt ?? 'n/a'}`);
    console.log(`* Requer recuperacao manual: ${state.requiresManualRecovery ? 'SIM' : 'NAO'}`);
    console.log(`* Versao do estado: ${state.version}`);
    console.log('======================================================\n');

    process.exit(state.mode === 'force-baseline' ? 1 : 0);
  } catch (error) {
    console.error('Erro ao ler o estado do circuit breaker:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
