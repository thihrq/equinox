import { execSync } from 'child_process';

const validationScripts = [
  'src/scripts/validateActiveV2RuntimeTelemetrySchema.ts',
  'src/scripts/validateActiveV2RuntimeMetricsAggregator.ts',
  'src/scripts/validateActiveV2RuntimeManifestHealth.ts',
  'src/scripts/validateActiveV2RuntimeAlertEvaluator.ts',
  'src/scripts/validateActiveV2RuntimeAuditLogger.ts',
  'src/scripts/validateActiveV2RuntimeDashboardFormatter.ts',
  'src/scripts/validateActiveV2RuntimeSyntheticInjectionGate.ts',
];

function runOfflineSuite(): void {
  console.log('[Equinox] Iniciando suíte de validacao offline agregada do Active V2 Runtime Observability V1...');

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
  console.log(`[Equinox] Todos os ${validationScripts.length} testes offline de observabilidade de runtime passaram!`);
  console.log('======================================================');
}

runOfflineSuite();
