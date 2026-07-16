import { execSync } from 'child_process';

const validationScripts = [
  'src/scripts/validateActiveV2RolloutHoldPolicy.ts',
  'src/scripts/validateActiveV2CanaryPhaseProgressionPolicy.ts',
  'src/scripts/validateActiveV2CanaryPhaseProgressionGate.ts',
];

function runOfflineSuite(): void {
  console.log('[Equinox] Iniciando suite de validacao offline agregada de rollout governance (hold + progressao de fase)...');

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
  console.log(`[Equinox] Todos os ${validationScripts.length} validadores offline de rollout governance passaram!`);
  console.log('======================================================');
}

runOfflineSuite();
