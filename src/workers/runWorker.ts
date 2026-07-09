import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { SmogonWorker } from './etl/SmogonWorker';
import { RadicalRedWorker } from './etl/RadicalRedWorker';
import { DataSyncService } from '../services/DataSyncService';

dotenv.config();

export const runDatabaseSeed = async (): Promise<void> => {
  // Roda a extração Vanilla base.
  await SmogonWorker.run();

  // Roda a extração Radical Red
  await RadicalRedWorker.run();

  // Executa o bootstrap do DataSyncService
  await DataSyncService.bootstrap();
};

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_teambuilder';
    await mongoose.connect(mongoUri);
    console.log('📦 Conectado ao MongoDB.');

    await runDatabaseSeed();

    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro de execução:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  run();
}
