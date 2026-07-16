import { execSync } from 'child_process';

const validationScripts = [
  'src/scripts/validateActiveV2InternalCanarySignature.ts',
  'src/scripts/validateActiveV2InternalCanarySecretRegistry.ts',
  'src/scripts/validateActiveV2InternalCanaryAllowlist.ts',
  'src/scripts/validateActiveV2InternalCanaryNonceStore.ts',
  'src/scripts/validateActiveV2InternalCanaryRateLimiter.ts',
  'src/scripts/validateActiveV2InternalCanaryAuthValidator.ts',
];

function runOfflineSuite(): void {
  console.log('[Equinox] Iniciando suíte de validacao offline agregada do Active V2 Internal Canary Auth (HMAC) V1...');

  for (const script of validationScripts) {
    const cmd = `npx ts-node ${script}`;
    console.log(`\nRodando: ${cmd}`);
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
      console.error(`Falha na execucao do comando de teste offline: ${cmd}`);
      process.exit(1);
    }
  }

  console.log('\n======================================================');
  console.log(`[Equinox] Todos os ${validationScripts.length} testes offline do canario interno (HMAC) passaram!`);
  console.log('======================================================');
}

runOfflineSuite();
