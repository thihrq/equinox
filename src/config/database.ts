import mongoose from 'mongoose';
import { appConfig } from './env';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(appConfig.mongoUri);
    console.log('📦 Conexão com o MongoDB estabelecida com sucesso.');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
};
