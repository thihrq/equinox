import * as crypto from 'crypto';
import { computeActiveV2InternalCanarySignature } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySignature';
import { loadActiveV2InternalCanarySecrets, findActiveActiveV2CanarySecretsAt } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanarySecretRegistry';
import { ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1 } from '../services/competitive-data/internal-canary-auth/ActiveV2InternalCanaryAuthPolicy';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/signActiveV2InternalCanaryRequest.ts --subject <nome> --request-path </caminho> [--secret <valor>] [--timestamp <epochMs>] [--nonce <valor>]');
  console.log('');
  console.log('  Se --secret nao for informado, usa o primeiro segredo ativo de EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS.');
}

function main(): void {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const subject = getArg('--subject');
  const requestPath = getArg('--request-path');
  let secret = getArg('--secret');
  const timestamp = getArg('--timestamp') ?? String(Date.now());
  const nonce = getArg('--nonce') ?? crypto.randomUUID();

  if (!subject || !requestPath) {
    console.error('Erro: --subject e --request-path sao obrigatorios.');
    printUsage();
    process.exit(2);
    return;
  }

  if (!secret) {
    let activeSecrets;
    try {
      const secrets = loadActiveV2InternalCanarySecrets();
      activeSecrets = findActiveActiveV2CanarySecretsAt(secrets, new Date(Number(timestamp)));
    } catch (error) {
      console.error('Erro ao carregar segredos:', error);
      process.exit(2);
      return;
    }
    if (activeSecrets.length === 0) {
      console.error('Erro: nenhum segredo fornecido (--secret) e nenhum segredo ativo encontrado em EQUINOX_ACTIVE_V2_CANARY_HMAC_SECRETS.');
      process.exit(2);
      return;
    }
    secret = activeSecrets[0].secret;
  }

  const signature = computeActiveV2InternalCanarySignature(subject, timestamp, nonce, requestPath, secret);
  const headerNames = ACTIVE_V2_INTERNAL_CANARY_AUTH_POLICY_V1.headerNames;

  console.log('\n======================================================');
  console.log('  Active V2 Internal Canary - Requisicao Assinada  ');
  console.log('======================================================');
  console.log(`${headerNames.subject}: ${subject}`);
  console.log(`${headerNames.timestamp}: ${timestamp}`);
  console.log(`${headerNames.nonce}: ${nonce}`);
  console.log(`${headerNames.signature}: ${signature}`);
  console.log('------------------------------------------------------');
  console.log('curl:');
  console.log(`  curl -H "${headerNames.subject}: ${subject}" -H "${headerNames.timestamp}: ${timestamp}" -H "${headerNames.nonce}: ${nonce}" -H "${headerNames.signature}: ${signature}" '<base-url>${requestPath}'`);
  console.log('======================================================\n');

  process.exit(0);
}

main();
