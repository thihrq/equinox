/// <reference types="node" />
import mongoose from 'mongoose';
import { PokemonSet } from '../models/PokemonSet';
import { DataSyncService } from '../services/DataSyncService';
import 'dotenv/config';

async function testSync() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon-builder';
  await mongoose.connect(MONGO_URI);
  console.log('📦 Conectado ao MongoDB para testes de sincronização.');

  await PokemonSet.deleteMany({});
  
  await DataSyncService.bootstrap();
  
  const count = await PokemonSet.countDocuments({});
  if (count === 0) {
    throw new Error('Falha no seed local dos conjuntos competetivos.');
  }

  console.log(`✅ Sincronização carregou ${count} conjuntos com sucesso!`);
  process.exit(0);
}

testSync().catch(err => {
  console.error('❌ Erro no teste de sincronização:', err);
  process.exit(1);
});
