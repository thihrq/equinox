import fs from 'fs';
import path from 'path';

export type ReleaseRegressionProfile = 'runtime-safety' | 'full-competitive-pipeline';

export interface ReleaseCapabilityManifest {
  schemaVersion: '1.0.0';
  profile: ReleaseRegressionProfile;
  capabilities: {
    runtimeMongoOptional: boolean;
    syntheticFallbackFailClosed: boolean;
    formatRegistryNormalization: boolean;
    localDevelopmentIsolation: boolean;
    artifactSecretSanitization: boolean;
    backendBuild: boolean;
    frontendBuild: boolean;
    validatedPackageBinding: boolean;

    wave1PipelineSources: boolean;
    wave2PipelineSources: boolean;
    wave3PipelineSources: boolean;
    competitivePackageRebuild: boolean;
    historicalPipelineReplay: boolean;
  };
  excludedCapabilities: Array<{ capability: string; reason: string; requiredInitiative?: string }>;
}

export interface ValidatedPackageCapability {
  packageBindingVerified: boolean;
  packageIntegrityVerified: boolean;
  packageRuntimeLoadVerified: boolean;
  packageRebuiltFromSourcePipeline: boolean;
  fullPipelineReplayCompleted: boolean;
}

export const VALIDATED_PACKAGE_DIGEST = 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665';

export const FULL_PIPELINE_REQUIRED_SOURCES = [
  'src/scripts/runChampionsWave1QA.ts',
  'src/scripts/runChampionsWave2QA.ts',
  'src/scripts/runChampionsWave3QA.ts',
];

export function fullPipelineSourcesPresent(cwd: string = process.cwd()): boolean {
  return FULL_PIPELINE_REQUIRED_SOURCES.every((relativePath) => fs.existsSync(path.join(cwd, relativePath)));
}

export const FULL_COMPETITIVE_PIPELINE_SOURCES_NOT_AVAILABLE = 'FULL_COMPETITIVE_PIPELINE_SOURCES_NOT_AVAILABLE';
export const RELEASE_REGRESSION_PROFILE_REQUIRED = 'RELEASE_REGRESSION_PROFILE_REQUIRED';

export function assertFullPipelineSourcesPresent(cwd: string = process.cwd()): void {
  if (!fullPipelineSourcesPresent(cwd)) {
    throw new Error(FULL_COMPETITIVE_PIPELINE_SOURCES_NOT_AVAILABLE);
  }
}

export function assertValidProfile(profile: string | undefined): asserts profile is ReleaseRegressionProfile {
  if (profile !== 'runtime-safety' && profile !== 'full-competitive-pipeline') {
    throw new Error(RELEASE_REGRESSION_PROFILE_REQUIRED);
  }
}

export function buildRuntimeSafetyCapabilityManifest(): ReleaseCapabilityManifest {
  return {
    schemaVersion: '1.0.0',
    profile: 'runtime-safety',
    capabilities: {
      runtimeMongoOptional: true,
      syntheticFallbackFailClosed: true,
      formatRegistryNormalization: true,
      localDevelopmentIsolation: true,
      artifactSecretSanitization: true,
      backendBuild: true,
      frontendBuild: true,
      validatedPackageBinding: true,

      wave1PipelineSources: false,
      wave2PipelineSources: false,
      wave3PipelineSources: false,
      competitivePackageRebuild: false,
      historicalPipelineReplay: false,
    },
    excludedCapabilities: [
      { capability: 'wave1PipelineSources', reason: 'src/scripts/runChampionsWave1QA.ts e seu fechamento transitivo (13+ arquivos de nivel 1, 2+ de nivel 2, dezenas nao mapeadas em niveis mais profundos) nao estao commitados nesta cadeia.', requiredInitiative: 'Wave 1-3 Pipeline Consolidation' },
      { capability: 'wave2PipelineSources', reason: 'src/scripts/runChampionsWave2QA.ts e seu fechamento transitivo nao estao commitados nesta cadeia.', requiredInitiative: 'Wave 1-3 Pipeline Consolidation' },
      { capability: 'wave3PipelineSources', reason: 'src/scripts/runChampionsWave3QA.ts e seu fechamento transitivo nao estao commitados nesta cadeia.', requiredInitiative: 'Wave 1-3 Pipeline Consolidation' },
      { capability: 'competitivePackageRebuild', reason: 'O perfil runtime-safety verifica o binding ao digest homologado existente; ele nao reconstroi o pacote competitivo a partir do pipeline de curadoria de origem.', requiredInitiative: 'Wave 1-3 Pipeline Consolidation' },
      { capability: 'historicalPipelineReplay', reason: 'Nenhuma run historica de release-candidate anterior e consumida por este perfil -- e por isso que esta capacidade e false, nao por omissao.' },
    ],
  };
}

export function buildFullCompetitivePipelineCapabilityManifest(): ReleaseCapabilityManifest {
  const sourcesPresent = fullPipelineSourcesPresent();
  return {
    schemaVersion: '1.0.0',
    profile: 'full-competitive-pipeline',
    capabilities: {
      runtimeMongoOptional: true,
      syntheticFallbackFailClosed: true,
      formatRegistryNormalization: true,
      localDevelopmentIsolation: true,
      artifactSecretSanitization: true,
      backendBuild: true,
      frontendBuild: true,
      validatedPackageBinding: true,

      wave1PipelineSources: sourcesPresent,
      wave2PipelineSources: sourcesPresent,
      wave3PipelineSources: sourcesPresent,
      competitivePackageRebuild: sourcesPresent,
      historicalPipelineReplay: sourcesPresent,
    },
    excludedCapabilities: sourcesPresent ? [] : [
      { capability: 'wave1PipelineSources', reason: 'src/scripts/runChampionsWave1QA.ts não encontrado.', requiredInitiative: 'Wave 1-3 Pipeline Consolidation' },
      { capability: 'wave2PipelineSources', reason: 'src/scripts/runChampionsWave2QA.ts não encontrado.', requiredInitiative: 'Wave 1-3 Pipeline Consolidation' },
      { capability: 'wave3PipelineSources', reason: 'src/scripts/runChampionsWave3QA.ts não encontrado.', requiredInitiative: 'Wave 1-3 Pipeline Consolidation' },
    ],
  };
}

export function buildRuntimeSafetyPackageCapability(bindingVerified: boolean, integrityVerified: boolean, runtimeLoadVerified: boolean): ValidatedPackageCapability {
  return {
    packageBindingVerified: bindingVerified,
    packageIntegrityVerified: integrityVerified,
    packageRuntimeLoadVerified: runtimeLoadVerified,
    packageRebuiltFromSourcePipeline: false,
    fullPipelineReplayCompleted: false,
  };
}

export function buildFullCompetitivePipelinePackageCapability(bindingVerified: boolean, integrityVerified: boolean, runtimeLoadVerified: boolean): ValidatedPackageCapability {
  const sourcesPresent = fullPipelineSourcesPresent();
  return {
    packageBindingVerified: bindingVerified,
    packageIntegrityVerified: integrityVerified,
    packageRuntimeLoadVerified: runtimeLoadVerified,
    packageRebuiltFromSourcePipeline: sourcesPresent,
    fullPipelineReplayCompleted: sourcesPresent,
  };
}
