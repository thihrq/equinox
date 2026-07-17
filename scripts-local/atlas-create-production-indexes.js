/**
 * Cria os índices reais exigidos por verifyProductionIndexesAndDuplicities
 * (ActiveV2ProductionPreflight.ts) em pokemonsets_v2 e publication_manifests
 * no Atlas de produção real. Não existe script dedicado a isso no pipeline
 * principal — o publisher só VERIFICA a presença dos índices, nunca os cria.
 *
 * Criar um índice numa coleção inexistente cria a coleção junto — este é o
 * momento em que pokemonsets_v2/publication_manifests passam a existir de
 * verdade em produção pela primeira vez (ainda vazias, sem documentos).
 */
const dns = require('dns');
dns.setServers(['8.8.8.8']);

const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: true });
}

const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is required');
    process.exit(2);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(); // usa o banco da própria connection string (test)

  const setsCol = db.collection('pokemonsets_v2');
  await setsCol.createIndex({ setId: 1, publishRunId: 1 }, { unique: true, name: 'setId_1_publishRunId_1' });
  await setsCol.createIndex(
    { setId: 1 },
    { unique: true, partialFilterExpression: { active: true }, name: 'setId_1_active_partial' }
  );

  const manifestCol = db.collection('publication_manifests');
  await manifestCol.createIndex({ publishRunId: 1 }, { unique: true, name: 'publishRunId_1' });

  const setsIndexes = await setsCol.indexes();
  const manifestIndexes = await manifestCol.indexes();
  console.log(`[create-indexes] banco: ${db.databaseName}`);
  console.log('[create-indexes] pokemonsets_v2 indexes:', JSON.stringify(setsIndexes, null, 2));
  console.log('[create-indexes] publication_manifests indexes:', JSON.stringify(manifestIndexes, null, 2));

  await client.close();
}

main().catch(err => {
  console.error('[create-indexes] failed:', err);
  process.exit(1);
});
