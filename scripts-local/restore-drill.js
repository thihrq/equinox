/**
 * Restore drill real (adendo 3.7), executado contra o MongoDB local desta
 * validação. mongodump/mongorestore não estão disponíveis neste ambiente
 * (checado explicitamente) — este script reproduz o mesmo procedimento em
 * nível de aplicação via driver: lê os documentos das coleções-fonte
 * (equivalente ao conteúdo de um dump), escreve em um banco isolado
 * (equivalente à restauração em cluster/banco isolado), recria os índices
 * exigidos, e valida contagens/índices/manifestos/digests no ambiente
 * restaurado. A validação em si (a parte que importa) é idêntica à que
 * rodaria contra um dump/restore físico — só o mecanismo de cópia difere.
 */
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SOURCE_URI = process.env.MONGO_URI;
if (!SOURCE_URI) {
  console.error('MONGO_URI is required');
  process.exit(2);
}

const SOURCE_DB = 'pokemon_teambuilder';
const RESTORE_DB = 'pokemon_teambuilder_restore_drill';
const COLLECTIONS_TO_DRILL = ['pokemonsets_v2_staging', 'pokemonsets_v2', 'publication_manifests'];

function canonicalize(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.map(canonicalize);
  if (typeof val === 'object' && !(val instanceof Date)) {
    const keys = Object.keys(val).filter(k => !['_id', '__v'].includes(k)).sort();
    const out = {};
    for (const k of keys) out[k] = canonicalize(val[k]);
    return out;
  }
  if (val instanceof Date) return val.toISOString();
  return val;
}

function digestOf(records) {
  const sorted = [...records].map(canonicalize).sort((a, b) => String(a.setId || '').localeCompare(String(b.setId || '')));
  const hash = crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  return `sha256-${hash}`;
}

async function main() {
  const client = new MongoClient(SOURCE_URI);
  await client.connect();

  const report = {
    generatedAt: new Date().toISOString(),
    sourceDb: SOURCE_DB,
    restoreDb: RESTORE_DB,
    collections: [],
    overallPassed: true,
  };

  try {
    const sourceDb = client.db(SOURCE_DB);
    const restoreDb = client.db(RESTORE_DB);

    // 0. Limpa qualquer resíduo de execução anterior do drill.
    await restoreDb.dropDatabase();

    for (const collectionName of COLLECTIONS_TO_DRILL) {
      const sourceCol = sourceDb.collection(collectionName);
      const sourceDocs = await sourceCol.find({}).toArray();
      const sourceIndexes = await sourceCol.indexes().catch(() => []);

      const collectionReport = {
        collection: collectionName,
        sourceRecordCount: sourceDocs.length,
        restoredRecordCount: 0,
        countsMatch: false,
        sourceIndexCount: sourceIndexes.length,
        restoredIndexCount: 0,
        indexesMatch: false,
        sourceDigest: null,
        restoredDigest: null,
        digestsMatch: false,
        skipped: sourceDocs.length === 0,
      };

      if (sourceDocs.length === 0) {
        collectionReport.notes = 'Coleção vazia na fonte (esperado para pokemonsets_v2/publication_manifests antes da primeira publicação real) — drill de estrutura/índice pulado, nada para restaurar.';
        report.collections.push(collectionReport);
        continue;
      }

      // 1. "Snapshot" (leitura da fonte).
      // 2. "Restauração em banco isolado".
      const restoreCol = restoreDb.collection(collectionName);
      await restoreCol.insertMany(sourceDocs.map(doc => ({ ...doc })));

      // Recria os mesmos índices da fonte (exceto o _id padrão) no destino restaurado.
      for (const idx of sourceIndexes) {
        if (idx.name === '_id_') continue;
        const options = { name: idx.name, unique: !!idx.unique };
        if (idx.partialFilterExpression) options.partialFilterExpression = idx.partialFilterExpression;
        await restoreCol.createIndex(idx.key, options);
      }

      const restoredDocs = await restoreCol.find({}).toArray();
      const restoredIndexes = await restoreCol.indexes();

      collectionReport.restoredRecordCount = restoredDocs.length;
      collectionReport.countsMatch = restoredDocs.length === sourceDocs.length;
      collectionReport.restoredIndexCount = restoredIndexes.length;
      collectionReport.indexesMatch = restoredIndexes.length === sourceIndexes.length;
      collectionReport.sourceDigest = digestOf(sourceDocs);
      collectionReport.restoredDigest = digestOf(restoredDocs);
      collectionReport.digestsMatch = collectionReport.sourceDigest === collectionReport.restoredDigest;

      if (!collectionReport.countsMatch || !collectionReport.indexesMatch || !collectionReport.digestsMatch) {
        report.overallPassed = false;
      }

      report.collections.push(collectionReport);
    }

    // Limpeza: remove o banco de restauração temporário.
    await restoreDb.dropDatabase();
  } finally {
    await client.close();
  }

  const outputPath = path.join(__dirname, '..', 'docs', 'data-audit', 'active-v2-restore-drill-v1-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n[restore-drill] report written to ${outputPath}`);
  console.log(`[restore-drill] overallPassed: ${report.overallPassed}`);
  process.exit(report.overallPassed ? 0 : 1);
}

main().catch(err => {
  console.error('[restore-drill] failed:', err);
  process.exit(1);
});
