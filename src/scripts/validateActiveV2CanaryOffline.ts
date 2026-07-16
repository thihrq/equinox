import { execSync } from 'child_process';

const validationScripts = [
  'src/scripts/validateActiveV2CanarySelector.ts',
  'src/scripts/validateActiveV2CanaryTransitionPolicy.ts',
  'src/scripts/validateActiveV2CanaryConfigWriteGuard.ts',
  'src/scripts/validateActiveV2CanaryConfigStore.ts',
  'src/scripts/validateActiveV2RuntimeDecisionResolver.ts',
];

function runOfflineSuite(): void {
  console.log('[Equinox] Iniciando suíte de validacao offline agregada da Active V2 Canary Infrastructure V1...');

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
  console.log(`[Equinox] Todos os ${validationScripts.length} testes offline da infraestrutura de canario passaram!`);
  console.log('======================================================');
}

runOfflineSuite();
