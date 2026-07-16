import { execSync } from 'child_process';

function runOfflineIntegration(): void {
  console.log('[Equinox] Iniciando suíte de validacao offline agregada do Acceptance Gates V1...');

  const commands = [
    'npx ts-node src/scripts/validateActiveV2AcceptanceContracts.ts',
    'npx ts-node src/scripts/validateActiveV2AcceptanceEvidenceValidator.ts',
    'npx ts-node src/scripts/validateActiveV2AcceptanceClassifier.ts',
    'npx ts-node src/scripts/validateActiveV2AcceptanceGates.ts',
    'npx ts-node src/scripts/validateActiveV2AcceptanceReportWriter.ts',
    'npx ts-node src/scripts/validateActiveV2AcceptanceCliExitCodes.ts',
  ];

  for (const cmd of commands) {
    console.log(`\nRodando: ${cmd}`);
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
      console.error(`Falha na execucao do comando de teste offline: ${cmd}`);
      process.exit(1);
    }
  }

  console.log('\n======================================================');
  console.log('[Equinox] Todos os testes offline de aceitacao passaram!');
  console.log('======================================================\n');
  process.exit(0);
}

runOfflineIntegration();
