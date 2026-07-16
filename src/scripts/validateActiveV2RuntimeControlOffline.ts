import { execSync } from 'child_process';

const validationScripts = [
  'src/scripts/validateActiveV2RuntimeControlWriteGuard.ts',
  'src/scripts/validateActiveV2RuntimeControlStore.ts',
  'src/scripts/validateActiveV2CircuitBreakerEvaluator.ts',
  'src/scripts/validateActiveV2RuntimeControlChangelogWriter.ts',
];

function runOfflineSuite(): void {
  console.log('[Equinox] Iniciando suíte de validacao offline agregada do Active V2 Runtime Control (Circuit Breaker) V1...');

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
  console.log(`[Equinox] Todos os ${validationScripts.length} testes offline do circuit breaker passaram!`);
  console.log('======================================================');
}

runOfflineSuite();
