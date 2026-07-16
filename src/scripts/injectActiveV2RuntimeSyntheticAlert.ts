import * as path from 'path';
import { runActiveV2RuntimeSyntheticInjectionGate } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeSyntheticInjectionGate';
import {
  formatSyntheticInjectionGateReportAsJson,
  formatSyntheticInjectionGateReportAsMarkdown,
} from '../services/competitive-data/runtime-observability/ActiveV2RuntimeSyntheticInjectionGateFormatter';
import { writeArtifactAtomically } from './support/writeActiveV2AcceptanceArtifacts';

function printUsage(): void {
  console.log('Uso:');
  console.log('  ts-node src/scripts/injectActiveV2RuntimeSyntheticAlert.ts [--output-json <path>] [--output-markdown <path>]');
}

function main(): void {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
    return;
  }

  const outputJsonPath = getArg('--output-json') ?? getArg('-j');
  const outputMarkdownPath = getArg('--output-markdown') ?? getArg('-m');

  const report = runActiveV2RuntimeSyntheticInjectionGate();

  const formattedJson = formatSyntheticInjectionGateReportAsJson(report);
  const formattedMarkdown = formatSyntheticInjectionGateReportAsMarkdown(report);

  if (outputJsonPath) {
    try {
      writeArtifactAtomically(outputJsonPath, formattedJson);
      console.log(`[Equinox] Relatorio JSON escrito com sucesso em: ${path.resolve(outputJsonPath)}`);
    } catch (error) {
      console.error(`Erro ao gravar relatorio JSON em "${outputJsonPath}":`, error);
      process.exit(1);
      return;
    }
  }

  if (outputMarkdownPath) {
    try {
      writeArtifactAtomically(outputMarkdownPath, formattedMarkdown);
      console.log(`[Equinox] Relatorio Markdown escrito com sucesso em: ${path.resolve(outputMarkdownPath)}`);
    } catch (error) {
      console.error(`Erro ao gravar relatorio Markdown em "${outputMarkdownPath}":`, error);
      process.exit(1);
      return;
    }
  }

  console.log('\n======================================================');
  console.log('  Active V2 Runtime Observability - Synthetic Injection Gate  ');
  console.log('======================================================');
  console.log(`* Gate da Fase 2A: [ ${report.gatePassed ? 'APROVADO' : 'REPROVADO'} ]`);
  console.log(`* Todos os alertas dispararam: [ ${report.allFired ? 'SIM' : 'NAO'} ]`);
  console.log(`* Todos dentro do SLA de ${report.slaMs}ms: [ ${report.allWithinSla ? 'SIM' : 'NAO'} ]`);
  console.log('------------------------------------------------------');
  report.scenarios.forEach(scenario => {
    console.log(`  - ${scenario.alertCode}: ${scenario.fired ? 'disparou' : 'NAO disparou'} em ${scenario.elapsedMs}ms`);
  });
  console.log('======================================================\n');

  process.exit(report.gatePassed ? 0 : 1);
}

main();
