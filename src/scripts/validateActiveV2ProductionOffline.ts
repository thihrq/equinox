import { execSync } from 'child_process';

const validationScripts = [
  'src/scripts/validateActiveV2ProductionContracts.ts',
  'src/scripts/validateActiveV2ProductionDigest.ts',
  'src/scripts/validateActiveV2ProductionLineage.ts',
  'src/scripts/validateActiveV2ProductionPreflight.ts',
  'src/scripts/validateActiveV2ProductionPublisher.ts',
  'src/scripts/validateActiveV2ProductionRollback.ts',
  'src/scripts/validateActiveV2ProductionCliExitCodes.ts',
  'src/scripts/validateActiveV2DataFreezeGuard.ts',
  'src/scripts/validateActiveV2ProductionTransactionRetry.ts'
];

function runOfflineSuite(): void {
  console.log('[Equinox] Iniciando suíte de validacao offline agregada do Active V2 Production V1...');

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
  console.log(`[Equinox] Todos os ${validationScripts.length} validadores offline de publicacao e rollback passaram!`);
  console.log('======================================================');
}

runOfflineSuite();
