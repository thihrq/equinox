import { createCandidateSourceParityManifest } from './CandidateSourceParityManifest';
import { verifyCandidateSourceParity } from './CandidateSourceParityVerifier';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

export function testCandidateSourceParityVerifier() {
  console.log('[Equinox Test] Testando o verificador de paridade da fonte de candidatos...');

  const baseManifest = createCandidateSourceParityManifest({
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
      environment: 'staging',
    },
  });

  // 1. Manifestos idênticos -> valid = true
  const identicalManifest = createCandidateSourceParityManifest({
    ...baseManifest,
    runtime: { ...baseManifest.runtime, environment: 'production' },
  });
  const res1 = verifyCandidateSourceParity(baseManifest, identicalManifest);
  assert(res1.valid === true, 'Manifestos idênticos no conteúdo canônico devem ser válidos');
  assert(res1.blockingDifferences.length === 0, 'Diferenças bloqueantes devem ser 0');
  assert(res1.informationalDifferences.length === 1, 'Deve registrar 1 diferença informativa de ambiente (staging vs production)');

  // 2. Divergência no competitiveSetDigest -> valid = false (BLOCKING)
  const differentSetDigestManifest = createCandidateSourceParityManifest({
    ...baseManifest,
    competitiveData: {
      ...baseManifest.competitiveData,
      competitiveSetDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    },
  });
  const res2 = verifyCandidateSourceParity(baseManifest, differentSetDigestManifest);
  assert(res2.valid === false, 'Divergência de competitiveSetDigest deve tornar a verificação inválida');
  assert(res2.blockingDifferences.some(d => d.reasonCode === 'COMPETITIVE_SET_DIGEST_MISMATCH'), 'Deve conter razão COMPETITIVE_SET_DIGEST_MISMATCH');

  // 3. Divergência na contagem com digest igual -> valid = true com WARNING
  const countDiffManifest = createCandidateSourceParityManifest({
    ...baseManifest,
    competitiveData: {
      ...baseManifest.competitiveData,
      competitiveSetCount: 160,
    },
  });
  const res3 = verifyCandidateSourceParity(baseManifest, countDiffManifest);
  assert(res3.valid === true, 'Divergência de contagem com digest igual deve manter valid = true');
  assert(res3.warnings.some(d => d.reasonCode === 'SET_COUNT_DIFFERENCE'), 'Deve conter aviso SET_COUNT_DIFFERENCE');

  console.log('✅ CandidateSourceParityVerifier testado com sucesso!');
}

if (require.main === module) {
  testCandidateSourceParityVerifier();
}
