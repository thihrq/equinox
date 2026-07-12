import mongoose from 'mongoose';
import { appConfig } from './env';
import { assertMongoAccessAllowed, markMongoConnected } from '../equinox/data-audit/DataAuditRuntime';

export const connectDatabase = async (): Promise<void> => {
  try {
    assertMongoAccessAllowed('connectDatabase');
    await mongoose.connect(appConfig.mongoUri);
    markMongoConnected();
    console.log('📦 Conexão com o MongoDB estabelecida com sucesso.');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
};
