import mongoose from 'mongoose';
import { appConfig } from '../config/env';
import { buildAuditRuntimeReport, markMongoConnected, markMongoRead, printAuditRuntimeReport, resolveDataMode } from '../equinox/data-audit/DataAuditRuntime';
import { Pokemon } from '../models/Pokemon';
import { PokemonSet } from '../models/PokemonSet';

async function run(): Promise<void> {
  if (resolveDataMode() === 'filesystem') {
    const report = {
      generatedAt: new Date().toISOString(),
      dataMode: 'filesystem',
      pokemonSetCount: 0,
      pokemonCount: 0,
      latestUpdatedAt: null,
      v2ActiveCount: 0,
      v2DraftCount: 0,
      mongoConnected: false,
      mongoReads: 0,
      mongoWrites: 0,
      note: 'Mongo snapshot skipped because EQUINOX_DATA_MODE=filesystem.',
    };
    console.log(JSON.stringify(report, null, 2));
    printAuditRuntimeReport(buildAuditRuntimeReport());
    return;
  }

  try {
    await mongoose.connect(appConfig.mongoUri);
    markMongoConnected();
    const [pokemonSetCount, pokemonCount, latest, v2ActiveCount, v2DraftCount] = await Promise.all([
      PokemonSet.countDocuments({}),
      Pokemon.countDocuments({}),
      PokemonSet.find({}).sort({ updatedAt: -1 }).limit(1).lean().exec(),
      PokemonSet.countDocuments({ dataVersion: { $exists: true }, status: 'active' }),
      PokemonSet.countDocuments({ dataVersion: { $exists: true }, status: 'draft' }),
    ]);
    markMongoRead(5);

    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      dataMode: resolveDataMode(),
      pokemonSetCount,
      pokemonCount,
      latestUpdatedAt: (latest[0] as { updatedAt?: Date } | undefined)?.updatedAt ?? null,
      v2ActiveCount,
      v2DraftCount,
      mongoConnected: true,
      mongoReads: 5,
      mongoWrites: 0,
    }, null, 2));
    printAuditRuntimeReport(buildAuditRuntimeReport());
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
