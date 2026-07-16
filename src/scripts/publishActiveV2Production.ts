import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { publishToProduction } from '../services/competitive-data/publication/ActiveV2ProductionPublisher';

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

  const reportPath = getArg('--acceptance-report');
  const publishRunId = getArg('--publish-run-id');
  const sourceCollection = getArg('--source-collection') || 'pokemonsets_v2_staging';
  const targetCollection = getArg('--target-collection') || 'pokemonsets_v2';
  const dryRun = hasArg('--dry-run');
  const emergencyOverride = hasArg('--emergency-override');
  const emergencyJustification = getArg('--emergency-justification') ?? null;

  // 1.1 Publicação emergencial durante congelamento de dados (adendo seção 13)
  // exige justificativa explícita já na chamada — não basta a flag sozinha.
  if (emergencyOverride && (!emergencyJustification || emergencyJustification.trim().length === 0)) {
    console.error('[Equinox] Erro: --emergency-override exige --emergency-justification "<motivo>" nao vazio.');
    process.exit(2);
  }

  // 1. Validar se argumentos obrigatorios foram fornecidos
  if (!reportPath || !publishRunId) {
    console.error('[Equinox] Erro: Argumentos --acceptance-report e --publish-run-id sao obrigatorios.');
    process.exit(2);
  }

  // 2. Validar flags de seguranca de ambiente
  const env = process.env;
  const enablePub = env.EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION === 'true';
  const allowWrites = env.EQUINOX_ALLOW_DATABASE_WRITES === 'true';
  const targetEnv = env.EQUINOX_ACTIVE_V2_PRODUCTION_TARGET;

  if (dryRun) {
    if (!enablePub || allowWrites) {
      console.error('[Equinox] Erro de Seguranca: Dry-run exige EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION=true e EQUINOX_ALLOW_DATABASE_WRITES=false.');
      process.exit(2);
    }
  } else {
    if (!enablePub || !allowWrites || targetEnv !== 'pokemonsets_v2') {
      console.error('[Equinox] Erro de Seguranca: Publicacao real exige EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION=true, EQUINOX_ALLOW_DATABASE_WRITES=true e EQUINOX_ACTIVE_V2_PRODUCTION_TARGET=pokemonsets_v2.');
      process.exit(2);
    }
  }

  // 3. Validar se arquivo de aceitacao existe e fazer parse do JSON
  const absoluteReportPath = path.resolve(reportPath);
  if (!fs.existsSync(absoluteReportPath)) {
    console.error(`[Equinox] Erro: Arquivo de aceitacao nao encontrado em ${absoluteReportPath}`);
    process.exit(3);
  }

  let acceptanceReport: any;
  try {
    const rawContent = fs.readFileSync(absoluteReportPath, 'utf8').replace(/^\uFEFF/, '');
    acceptanceReport = JSON.parse(rawContent);
  } catch (error) {
    console.error('[Equinox] Erro no parse do JSON do relatorio de aceitacao:', error);
    process.exit(3);
  }

  // 4. Conectar ao MongoDB
  const mongoUri = requireMongoUri(env);
  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('[Equinox] Erro de conexao ao MongoDB:', error);
    process.exit(3);
  }

  // 5. Chamar motor de publicacao
  try {
    const result = await publishToProduction(acceptanceReport, mongoose.connection, {
      publishRunId,
      dryRun,
      sourceCollection,
      targetCollection,
      emergencyOverride,
      emergencyJustification,
    });

    console.log(`[Equinox] Resultado da Publicacao: Status [ ${result.status.toUpperCase()} ]`);
    if (result.reasonCode) {
      console.log(`[Equinox] Codigo de Retorno: ${result.reasonCode}`);
    }
    
    // Sucesso ou no-op -> Exit Code 0
    process.exit(0);
  } catch (error: any) {
    console.error('[Equinox] Falha na Publicacao:', error.message || error);
    
    // Bloqueios de linhagem, preflight ou transacionais -> Exit Code 1
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
