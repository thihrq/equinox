import * as path from 'path';
import mongoose from 'mongoose';
import { homologateActiveV2RuntimeRead } from '../services/competitive-data/runtime-read/ActiveV2RuntimeReadHomologationValidator';
import { resolveActiveV2RuntimeReadMode } from '../services/competitive-data/runtime-read/ActiveV2RuntimeReadFlagResolver';
import {
  formatRuntimeReadHomologationAsJson,
  formatRuntimeReadHomologationAsMarkdown,
} from '../services/competitive-data/runtime-read/ActiveV2RuntimeReadHomologationFormatter';
import { writeArtifactAtomically } from './support/writeActiveV2AcceptanceArtifacts';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/homologateActiveV2RuntimeRead.ts [--output-json <path>] [--output-markdown <path>]');
  console.log('');
  console.log('  Le o modo (ligado/desligado) de EQUINOX_ACTIVE_V2_RUNTIME_READ_ENABLED.');
  console.log('  Quando desligado, roda em modo baseline-only: nao tenta ler pokemonsets_v2.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
    return;
  }

  const outputJsonPath = getArg('--output-json') ?? getArg('-j');
  const outputMarkdownPath = getArg('--output-markdown') ?? getArg('-m');
  const mode = resolveActiveV2RuntimeReadMode();

  let connection: mongoose.Connection | null = null;

  if (mode === 'active-v2-read') {
    const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Erro de Configuracao: MONGO_URI ou MONGODB_URI e obrigatorio quando EQUINOX_ACTIVE_V2_RUNTIME_READ_ENABLED=true.');
      process.exit(2);
      return;
    }

    try {
      await mongoose.connect(mongoUri);
      connection = mongoose.connection;
    } catch (error) {
      console.error('Erro ao conectar ao MongoDB:', error);
      process.exit(3);
      return;
    }
  }

  try {
    const result = await homologateActiveV2RuntimeRead(connection, mode);

    const formattedJson = formatRuntimeReadHomologationAsJson(result);
    const formattedMarkdown = formatRuntimeReadHomologationAsMarkdown(result);

    if (outputJsonPath) {
      writeArtifactAtomically(outputJsonPath, formattedJson);
      console.log(`[Equinox] Relatorio JSON escrito com sucesso em: ${path.resolve(outputJsonPath)}`);
    }

    if (outputMarkdownPath) {
      writeArtifactAtomically(outputMarkdownPath, formattedMarkdown);
      console.log(`[Equinox] Relatorio Markdown escrito com sucesso em: ${path.resolve(outputMarkdownPath)}`);
    }

    console.log('\n======================================================');
    console.log('  Active V2 Production Runtime Read Homologation  ');
    console.log('======================================================');
    console.log(`* Modo: [ ${result.mode} ]`);
    console.log(`* Aprovado: [ ${result.approved ? 'SIM' : 'NAO'} ]`);
    console.log(`* Registros lidos: ${result.recordCount}`);
    console.log(`* Problemas encontrados: ${result.recordIssues.length}`);
    console.log('======================================================\n');

    process.exit(result.approved ? 0 : 1);
  } catch (error) {
    console.error('Erro na homologacao de leitura do runtime:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
    }
  }
}

main();
