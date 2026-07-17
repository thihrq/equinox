/**
 * Restore drill OFICIAL (adendo 3.7) contra o Atlas real, usando os
 * binários reais mongodump/mongorestore (Database Tools do MongoDB) — ao
 * contrário de restore-drill.js, que reproduz o mecanismo em nível de
 * aplicação via driver porque as ferramentas físicas não estavam
 * disponíveis. Aqui elas estão.
 *
 * Etapas (rodadas separadamente, cada uma exigindo confirmação explícita
 * antes da próxima, pelo padrão desta sessão para escrita em produção):
 *   dump    — mongodump da(s) coleção(ões)-fonte para disco local.
 *             SÓ LEITURA da fonte. Não escreve nada no Atlas.
 *   restore — mongorestore do dump para um banco ISOLADO (nunca o de
 *             produção), valida contagens/índices/digest contra a fonte,
 *             e limpa o banco isolado ao final. Escreve, mas só no banco
 *             isolado — nunca em `test.pokemonsets_v2_staging` ou
 *             qualquer coleção de produção.
 *
 * Uso:
 *   node scripts-local/atlas-restore-drill.js dump
 *   node scripts-local/atlas-restore-drill.js restore
 */
const { execFileSync } = require('child_process');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Workaround: resolver DNS padrao deste ambiente falha em consultas SRV.
dns.setServers(['8.8.8.8']);

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: true });
}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is required (.env)');
  process.exit(2);
}

const SOURCE_DB = 'test';
const RESTORE_DB = 'test_restore_drill';
// pokemonsets_v2/publication_manifests ainda nao existem (Fase 1 real
// ainda nao publicou) — cobrir aqui quando existirem.
const COLLECTIONS = ['pokemonsets_v2_staging', 'pokemonsets'];
const DUMP_DIR = path.join(__dirname, '..', '.atlas-restore-drill-dump');

function canonicalize(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.map(canonicalize);
  if (typeof val === 'object' && !(val instanceof Date) && !(val && val._bsontype)) {
    const keys = Object.keys(val).filter(k => !['_id', '__v'].includes(k)).sort();
    const out = {};
    for (const k of keys) out[k] = canonicalize(val[k]);
    return out;
  }
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function digestOf(records) {
  const sorted = [...records].map(canonicalize).sort((a, b) => String(a.setId || '').localeCompare(String(b.setId || '')));
  const hash = crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  return `sha256-${hash}`;
}

function runDump() {
  if (fs.existsSync(DUMP_DIR)) fs.rmSync(DUMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(DUMP_DIR, { recursive: true });

  const report = { generatedAt: new Date().toISOString(), sourceDb: SOURCE_DB, dumpDir: DUMP_DIR, collections: [] };

  for (const col of COLLECTIONS) {
    console.log(`[dump] ${SOURCE_DB}.${col}...`);
    try {
      execFileSync(
        'mongodump',
        ['--uri', MONGO_URI, '--db', SOURCE_DB, '--collection', col, '--out', DUMP_DIR],
        { stdio: 'inherit' }
      );
      report.collections.push({ collection: col, status: 'dumped' });
    } catch (error) {
      report.collections.push({ collection: col, status: 'failed', error: error.message });
    }
  }

  fs.writeFileSync(path.join(DUMP_DIR, 'dump-report.json'), JSON.stringify(report, null, 2));
  console.log('\n[dump] relatorio:', JSON.stringify(report, null, 2));
  console.log(`[dump] arquivos em: ${DUMP_DIR}`);
  console.log('[dump] ZERO escritas no Atlas. Proxima etapa (restore) precisa de confirmacao explicita.');
}

async function runRestore() {
  for (const col of COLLECTIONS) {
    const bsonPath = path.join(DUMP_DIR, SOURCE_DB, `${col}.bson`);
    if (!fs.existsSync(bsonPath)) {
      console.log(`[restore] ${col}: sem dump (coleção provavelmente vazia na fonte) — pulando.`);
      continue;
    }
    console.log(`[restore] ${SOURCE_DB}.${col} -> ${RESTORE_DB}.${col}...`);
    // --nsFrom/--nsTo só remapeiam namespace ao restaurar um diretório de
    // dump inteiro — restaurando um único arquivo .bson (como aqui), o
    // mongorestore ignora essas flags e usa o namespace original embutido
    // no dump (foi isso que causou o incidente: restaurou de volta em cima
    // da própria coleção de produção). --db/--collection explícitos são a
    // forma correta de redirecionar um restore de arquivo único.
    execFileSync(
      'mongorestore',
      ['--uri', MONGO_URI, '--db', RESTORE_DB, '--collection', col, '--drop', bsonPath],
      { stdio: 'inherit' }
    );
  }

  // readPreference/readConcern 'primary'/'majority' + retry curto: mongorestore
  // escreve via seu proprio processo/conexao: sem isso, uma leitura imediata
  // por uma conexao Node separada pode acertar um secundario ainda nao
  // replicado e reportar falso-negativo (visto na primeira tentativa: CLI
  // confirmou "14 documents, 0 failures" mas a leitura seguinte via driver
  // retornou 0 documentos).
  const client = new MongoClient(MONGO_URI, { readPreference: 'primary', readConcern: { level: 'majority' } });
  await client.connect();
  const report = { generatedAt: new Date().toISOString(), sourceDb: SOURCE_DB, restoreDb: RESTORE_DB, collections: [], overallPassed: true };

  async function readWithRetry(collection, expectedMinCount, attempts = 5, delayMs = 500) {
    for (let i = 0; i < attempts; i++) {
      const docs = await collection.find({}).toArray();
      if (docs.length >= expectedMinCount) return docs;
      if (i < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return collection.find({}).toArray();
  }

  try {
    const sourceDb = client.db(SOURCE_DB);
    const restoreDb = client.db(RESTORE_DB);

    for (const col of COLLECTIONS) {
      const sourceDocs = await sourceDb.collection(col).find({}).toArray();
      const restoredDocs = await readWithRetry(restoreDb.collection(col), sourceDocs.length);
      const sourceIndexes = await sourceDb.collection(col).indexes().catch(() => []);
      const restoredIndexes = await restoreDb.collection(col).indexes().catch(() => []);

      const collectionReport = {
        collection: col,
        sourceRecordCount: sourceDocs.length,
        restoredRecordCount: restoredDocs.length,
        countsMatch: sourceDocs.length === restoredDocs.length,
        sourceIndexCount: sourceIndexes.length,
        restoredIndexCount: restoredIndexes.length,
        sourceDigest: sourceDocs.length ? digestOf(sourceDocs) : null,
        restoredDigest: restoredDocs.length ? digestOf(restoredDocs) : null,
      };
      collectionReport.digestsMatch = collectionReport.sourceDigest === collectionReport.restoredDigest;
      if (!collectionReport.countsMatch || !collectionReport.digestsMatch) report.overallPassed = false;
      report.collections.push(collectionReport);
    }

    // Limpeza: remove o banco de restauracao isolado. Nunca toca no banco de producao.
    await restoreDb.dropDatabase();
    console.log(`[restore] banco isolado ${RESTORE_DB} removido apos validacao.`);
  } finally {
    await client.close();
  }

  const outPath = path.join(__dirname, '..', 'docs', 'data-audit', 'active-v2-restore-drill-atlas-v1-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\n[restore] relatorio:', JSON.stringify(report, null, 2));
  console.log(`[restore] relatorio salvo em: ${outPath}`);
  console.log(`[restore] overallPassed: ${report.overallPassed}`);
  process.exit(report.overallPassed ? 0 : 1);
}

const stage = process.argv[2];
if (stage === 'dump') {
  runDump();
} else if (stage === 'restore') {
  runRestore().catch(err => {
    console.error('[restore] failed:', err);
    process.exit(1);
  });
} else {
  console.error('Uso: node scripts-local/atlas-restore-drill.js <dump|restore>');
  process.exit(2);
}
