/**
 * Cria os índices reais exigidos por verifyProductionIndexesAndDuplicities
 * (ActiveV2ProductionPreflight.ts) em pokemonsets_v2 e publication_manifests.
 * Não existe script dedicado a isso no pipeline — o publisher só VERIFICA
 * a presença dos índices, não os cria. Este é o passo operacional que
 * precisaria rodar manualmente (ou via um script de setup de coleção) antes
 * da primeira publicação real em produção.
 */
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('pokemon_teambuilder');

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
  console.log('[create-indexes] pokemonsets_v2 indexes:', JSON.stringify(setsIndexes, null, 2));
  console.log('[create-indexes] publication_manifests indexes:', JSON.stringify(manifestIndexes, null, 2));

  await client.close();
}

main().catch(err => {
  console.error('[create-indexes] failed:', err);
  process.exit(1);
});
