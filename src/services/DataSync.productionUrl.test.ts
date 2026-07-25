import { resolveRemoteManifestUrl } from './DataSyncService';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testDataSyncProductionUrlResolution() {
  console.log('[Equinox Test] Auditando a resolução de URL remota do DataSync...');

  // Caso 1: Path relativo simples abaixo de base path do GitHub Pages
  const url1 = resolveRemoteManifestUrl(
    'https://thihrq.github.io/equinox/',
    'data/competitive/manifest.json',
  );
  assert(
    url1 === 'https://thihrq.github.io/equinox/data/competitive/manifest.json',
    `Esperava https://thihrq.github.io/equinox/data/competitive/manifest.json, recebeu ${url1}`,
  );

  // Caso 2: Path com barra inicial que anteriormente descartava o subcaminho /equinox/
  const url2 = resolveRemoteManifestUrl(
    'https://thihrq.github.io/equinox/',
    '/data/competitive/manifest.json',
  );
  assert(
    url2 === 'https://thihrq.github.io/equinox/data/competitive/manifest.json',
    `Esperava https://thihrq.github.io/equinox/data/competitive/manifest.json (preservando subcaminho), recebeu ${url2}`,
  );

  // Caso 3: Base URL sem barra final
  const url3 = resolveRemoteManifestUrl(
    'https://thihrq.github.io/equinox',
    '/data/competitive/manifest.json',
  );
  assert(
    url3 === 'https://thihrq.github.io/equinox/data/competitive/manifest.json',
    `Esperava https://thihrq.github.io/equinox/data/competitive/manifest.json, recebeu ${url3}`,
  );

  console.log('✅ Testes de resolução de URL remota do DataSync passaram com sucesso!');
}

if (require.main === module) {
  testDataSyncProductionUrlResolution();
}
