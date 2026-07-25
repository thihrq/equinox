import path from 'path';
import { inspectCompetitivePipelineRuntimeBoundary } from '../config/competitivePipelineRuntimeBoundary';

function runCheck(): void {
  const repositoryRoot = path.resolve(__dirname, '../../');
  console.log('[Equinox] Auditando isolamento do pipeline competitivo em relação ao runtime produtivo...');

  const result = inspectCompetitivePipelineRuntimeBoundary({
    repositoryRoot,
    runtimeEntrypoints: ['src/server.ts', 'src/apiRoutes.ts', 'src/controllers/TeamController.ts'],
    lifecycleFiles: ['package.json', 'frontend/package.json'],
  });

  if (!result.valid) {
    console.error('🚨 VIOLAÇÃO DE FRONTEIRA DETECTADA!');
    console.error(JSON.stringify(result.violations, null, 2));
    process.exit(1);
  }

  console.log(`✅ Fronteira auditada com sucesso: ${result.inspectedModuleCount} módulos verificados sem violações.`);
}

runCheck();
