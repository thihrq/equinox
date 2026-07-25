import { classifyReleaseEntry, RELEASE_METADATA_CLASSIFICATION } from './releaseArtifactEntryClassification';

export function runReleaseArtifactEntryClassificationTests(): void {
  console.log('[releaseArtifactEntryClassification.test] Executando testes unitários do contrato de classificação...');

  // 1. Entradas estáveis conhecidas
  if (classifyReleaseEntry('backend/index.js') !== 'stable-content') throw new Error('Falha no teste: backend/index.js');
  if (classifyReleaseEntry('frontend/index.html') !== 'stable-content') throw new Error('Falha no teste: frontend/index.html');
  if (classifyReleaseEntry('validated-package/manifest.json') !== 'stable-content') throw new Error('Falha no teste: validated-package/manifest.json');
  if (classifyReleaseEntry('metadata/license-inventory.json') !== 'stable-content') throw new Error('Falha no teste: metadata/license-inventory.json');
  if (classifyReleaseEntry('metadata/runtime-configuration-schema.json') !== 'stable-content') throw new Error('Falha no teste: metadata/runtime-configuration-schema.json');

  // 2. Entradas de envelope de release
  if (classifyReleaseEntry('metadata/build-information.json') !== 'release-envelope') throw new Error('Falha no teste: metadata/build-information.json');
  if (classifyReleaseEntry('metadata/release-identity.json') !== 'release-envelope') throw new Error('Falha no teste: metadata/release-identity.json');

  // 3. Exceções fail-closed para metadados e diretórios não mapeados
  let metadataErrorCaught = false;
  try {
    classifyReleaseEntry('metadata/unknown-file.json');
  } catch (err: any) {
    if (err.message.includes('RELEASE_ARTIFACT_METADATA_CLASSIFICATION_REQUIRED')) {
      metadataErrorCaught = true;
    }
  }
  if (!metadataErrorCaught) throw new Error('Falha no teste: metadata/unknown-file.json não lançou RELEASE_ARTIFACT_METADATA_CLASSIFICATION_REQUIRED');

  let topLevelErrorCaught = false;
  try {
    classifyReleaseEntry('unknown-dir/file.txt');
  } catch (err: any) {
    if (err.message.includes('RELEASE_ARTIFACT_ENTRY_CLASSIFICATION_REQUIRED')) {
      topLevelErrorCaught = true;
    }
  }
  if (!topLevelErrorCaught) throw new Error('Falha no teste: unknown-dir/file.txt não lançou RELEASE_ARTIFACT_ENTRY_CLASSIFICATION_REQUIRED');

  console.log('[releaseArtifactEntryClassification.test] Todos os 4 testes unitários passaram com sucesso!');
}

if (require.main === module) {
  runReleaseArtifactEntryClassificationTests();
}
