import { createCandidateSourceParityManifest, computeCanonicalManifestDigest } from './CandidateSourceParityManifest';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCandidateSourceParityManifest() {
  console.log('[Equinox Test] Testando o manifesto de paridade da fonte de candidatos...');

  const manifest1 = createCandidateSourceParityManifest({
    software: {
      sourceCommit: 'ea3c377',
      artifactDigest: 'sha256:0e8ca8d5bededd5dce0c05a4db0a016b24be3396ad6e7ac274c49ce3a1d0cad0',
      queryVersion: 'v1.1.2',
      filterVersion: 'v1.1.2',
      stratifierVersion: 'v1.1.2',
      evaluatorVersion: 'v1.1.2',
    },
    competitiveData: {
      sourceMode: 'mongodb',
      competitivePackageDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
      competitiveSetDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
      pokemonDocumentCount: 1025,
      competitiveSetCount: 155,
    },
    runtime: {
      nodeVersion: process.version,
      runtimeProfile: 'standard',
      environment: 'test',
    },
  });

  assert(manifest1.schemaVersion === '1.0.0', 'schemaVersion deve ser 1.0.0');
  assert(manifest1.manifestDigest.startsWith('sha256:'), 'manifestDigest deve ser sha256 hex');

  // Testar determinismo independente de timestamp
  const manifest2 = createCandidateSourceParityManifest({
    software: manifest1.software,
    competitiveData: manifest1.competitiveData,
    runtime: manifest1.runtime,
  });

  assert(manifest1.manifestDigest === manifest2.manifestDigest, 'manifestDigest deve ser determinístico e independente de timestamp');

  // Testar redação de segredos
  const manifestWithSecret = createCandidateSourceParityManifest({
    software: manifest1.software,
    competitiveData: manifest1.competitiveData,
    runtime: {
      ...manifest1.runtime,
      relevantFeatureFlags: {
        SECRET_KEY: 'mongodb://user:password@localhost:27017/db',
      },
    },
  });

  assert(
    manifestWithSecret.runtime.relevantFeatureFlags['SECRET_KEY'] === '[REDACTED_SECRET]',
    'Segredo deve ser ocultado no manifesto',
  );

  console.log('✅ CandidateSourceParityManifest testado com sucesso!');
}

if (require.main === module) {
  testCandidateSourceParityManifest();
}
