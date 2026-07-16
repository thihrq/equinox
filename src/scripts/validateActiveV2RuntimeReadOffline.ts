import { execSync } from 'child_process';

const validationScripts = [
  'src/scripts/validateActiveV2RuntimeReader.ts',
  'src/scripts/validateActiveV2RuntimeReadHomologationValidator.ts',
  'src/scripts/validateActiveV2RuntimeReadFlagResolver.ts',
  'src/scripts/validateActiveV2RuntimeReadHomologationFormatter.ts',
];

function runOfflineSuite(): void {
  console.log('[Equinox] Iniciando suíte de validacao offline agregada da Active V2 Runtime Read Homologation V1...');

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
  console.log(`[Equinox] Todos os ${validationScripts.length} testes offline da homologacao de leitura passaram!`);
  console.log('======================================================');
}

runOfflineSuite();
