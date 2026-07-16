import mongoose from 'mongoose';
import { validateActiveV2InternalCanaryRequest } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthValidator';
import { printActiveV2InternalCanaryAuditEntry } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuditLogger';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/checkActiveV2InternalCanaryAuth.ts --subject <s> --timestamp <epochMs> --nonce <n> --signature <sig> --request-path </caminho>');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const subject = getArg('--subject');
  const timestamp = getArg('--timestamp');
  const nonce = getArg('--nonce');
  const signature = getArg('--signature');
  const requestPath = getArg('--request-path');

  if (!subject || !timestamp || !nonce || !signature || !requestPath) {
    console.error('Erro: --subject, --timestamp, --nonce, --signature e --request-path sao obrigatorios.');
    printUsage();
    process.exit(2);
    return;
  }

  const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Erro de Configuracao: MONGO_URI ou MONGODB_URI e obrigatorio no ambiente.');
    process.exit(2);
    return;
  }

  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(3);
    return;
  }

  try {
    const result = await validateActiveV2InternalCanaryRequest(
      mongoose.connection,
      { subject, timestamp, nonce, signature },
      requestPath
    );

    printActiveV2InternalCanaryAuditEntry(result, requestPath);

    console.log('\n======================================================');
    console.log('  Active V2 Internal Canary - Resultado da Validacao  ');
    console.log('======================================================');
    console.log(`* Autorizado: [ ${result.authorized ? 'SIM' : 'NAO'} ]`);
    console.log(`* Motivo de negacao: ${result.denialReason ?? 'n/a'}`);
    console.log('======================================================\n');

    process.exit(result.authorized ? 0 : 1);
  } catch (error) {
    console.error('Erro ao validar a requisicao de canario interno:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
