import mongoose from 'mongoose';
import { rollbackProductionBatch } from '../services/competitive-data/publication/ActiveV2ProductionRollback';

function requireMongoUri(env: NodeJS.ProcessEnv): string {
  const uri = env.MONGO_URI ?? env.MONGODB_URI;
  if (!uri) {
    console.error('[Equinox] Erro: MONGO_URI ou MONGODB_URI nao configurada no ambiente.');
    process.exit(2);
  }
  return uri;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const hasArg = (flag: string) => args.includes(flag);

  const runId = getArg('--run-id');
  const dryRun = hasArg('--dry-run');

  // 1. Validar se argumentos obrigatorios foram fornecidos
  if (!runId) {
    console.error('[Equinox] Erro: Argumento --run-id e obrigatorio.');
    process.exit(2);
  }

  // 2. Validar flags de seguranca de ambiente
  const env = process.env;
  const enableRollback = env.EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_ROLLBACK === 'true';
  const allowWrites = env.EQUINOX_ALLOW_DATABASE_WRITES === 'true';
  const targetEnv = env.EQUINOX_ACTIVE_V2_PRODUCTION_TARGET;

  if (dryRun) {
    if (!enableRollback || allowWrites) {
      console.error('[Equinox] Erro de Seguranca: Dry-run do rollback exige EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_ROLLBACK=true e EQUINOX_ALLOW_DATABASE_WRITES=false.');
      process.exit(2);
    }
  } else {
    if (!enableRollback || !allowWrites || targetEnv !== 'pokemonsets_v2') {
      console.error('[Equinox] Erro de Seguranca: Rollback real exige EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_ROLLBACK=true, EQUINOX_ALLOW_DATABASE_WRITES=true e EQUINOX_ACTIVE_V2_PRODUCTION_TARGET=pokemonsets_v2.');
      process.exit(2);
    }
  }

  // 3. Conectar ao MongoDB
  const mongoUri = requireMongoUri(env);
  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('[Equinox] Erro de conexao ao MongoDB:', error);
    process.exit(3);
  }

  // 4. Chamar motor de rollback
  try {
    const result = await rollbackProductionBatch(runId, mongoose.connection, { dryRun });
    console.log(`[Equinox] Resultado do Rollback: Status [ ${result.status.toUpperCase()} ]`);
    process.exit(0);
  } catch (error: any) {
    console.error('[Equinox] Falha no Rollback:', error.message || error);
    // Erros controlados como ROLLBACK_TARGET_NOT_ACTIVE -> Exit Code 1
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
