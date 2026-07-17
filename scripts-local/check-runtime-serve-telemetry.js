/**
 * Consulta os ultimos eventos de active_v2_runtime_telemetry gravados pelo
 * Runtime Serve (servePath='active-v2'), para confirmar se o orquestrador
 * rodou de verdade contra tráfego real, independente de qual Pokémon foi
 * sugerido em cada requisição.
 *
 * Uso: MONGO_URI=... node scripts-local/check-runtime-serve-telemetry.js
 */
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Erro: MONGO_URI ou MONGODB_URI e obrigatorio.');
    process.exit(2);
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('active_v2_runtime_telemetry');

  const totalCount = await col.countDocuments({});
  console.log(`Total de documentos na colecao: ${totalCount}\n`);

  const events = await col
    .find({})
    .sort({ _id: -1 })
    .limit(5)
    .toArray();

  console.log(`Ultimos ${events.length} documentos (estrutura completa, mais recentes primeiro):\n`);
  for (const e of events) {
    console.log(JSON.stringify(e, null, 2));
    console.log('---');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
