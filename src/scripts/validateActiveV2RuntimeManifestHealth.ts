import { computeActiveV2RuntimeManifestHealth } from '../services/competitive-data/runtime-observability/ActiveV2RuntimeManifestHealth';
import { calculateCanonicalActiveV2DataDigest } from '../services/competitive-data/digest/ActiveV2CanonicalDataDigest';

function makeConnection(options: {
  activeSets?: any[];
  activeManifest?: any | null;
  failOnSetsRead?: boolean;
}): any {
  const activeSets = options.activeSets ?? [];
  const activeManifest = options.activeManifest ?? null;

  return {
    db: {
      collection: (name: string) => {
        if (name === 'pokemonsets_v2') {
          return {
            find: () => ({
              toArray: async () => {
                if (options.failOnSetsRead) throw new Error('boom');
                return activeSets;
              },
            }),
          };
        }
        if (name === 'publication_manifests') {
          return {
            findOne: async () => activeManifest,
          };
        }
        throw new Error(`unexpected collection ${name}`);
      },
    },
  };
}

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: estado saudável (sets ativos = manifesto, digest confere) ---
  const activeSets = [
    { setId: 'set-a', setName: 'A' },
    { setId: 'set-b', setName: 'B' },
  ];
  const healthyDigest = calculateCanonicalActiveV2DataDigest(activeSets);

  const healthySnapshot = await computeActiveV2RuntimeManifestHealth(
    makeConnection({
      activeSets,
      activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: healthyDigest, recordCount: 2 },
    })
  );
  if (healthySnapshot.activeSetCount !== 2) throw new Error('Test 1 failed: expected activeSetCount 2');
  if (!healthySnapshot.manifestRecordCountMatchesActiveSetCount) throw new Error('Test 1 failed: expected recordCount match');
  if (!healthySnapshot.digestMatchesManifest) throw new Error('Test 1 failed: expected digest match');
  if (healthySnapshot.activeSetIdsWithMultipleActiveVersions.length !== 0) throw new Error('Test 1 failed: expected no duplicate active versions');

  // --- Caso de Teste 2: zero sets ativos, sem manifesto -> consistente (nada para publicar) ---
  const zeroSnapshot = await computeActiveV2RuntimeManifestHealth(makeConnection({ activeSets: [], activeManifest: null }));
  if (zeroSnapshot.activeSetCount !== 0) throw new Error('Test 2 failed: expected activeSetCount 0');
  if (!zeroSnapshot.manifestRecordCountMatchesActiveSetCount) throw new Error('Test 2 failed: expected trivial consistency with no manifest and no sets');
  if (!zeroSnapshot.digestMatchesManifest) throw new Error('Test 2 failed: expected trivial digest match with no manifest and no sets');

  // --- Caso de Teste 3: múltiplas versões ativas para o mesmo setId ---
  const duplicateSets = [
    { setId: 'set-a', publishRunId: 'run-1' },
    { setId: 'set-a', publishRunId: 'run-2' },
  ];
  const duplicateSnapshot = await computeActiveV2RuntimeManifestHealth(makeConnection({ activeSets: duplicateSets, activeManifest: null }));
  if (duplicateSnapshot.activeSetIdsWithMultipleActiveVersions.join(',') !== 'set-a') {
    throw new Error('Test 3 failed: expected set-a flagged with multiple active versions');
  }

  // --- Caso de Teste 4: recordCount do manifesto não confere com sets ativos ---
  const mismatchCountSnapshot = await computeActiveV2RuntimeManifestHealth(
    makeConnection({
      activeSets,
      activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: healthyDigest, recordCount: 99 },
    })
  );
  if (mismatchCountSnapshot.manifestRecordCountMatchesActiveSetCount) {
    throw new Error('Test 4 failed: expected recordCount mismatch to be detected');
  }

  // --- Caso de Teste 5: digest divergente do manifesto ---
  const digestMismatchSnapshot = await computeActiveV2RuntimeManifestHealth(
    makeConnection({
      activeSets,
      activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: 'sha256-wrong', recordCount: 2 },
    })
  );
  if (digestMismatchSnapshot.digestMatchesManifest) {
    throw new Error('Test 5 failed: expected digest mismatch to be detected');
  }

  // --- Caso de Teste 6: falha de leitura propaga MANIFEST_HEALTH_CHECK_FAILED ---
  try {
    await computeActiveV2RuntimeManifestHealth(makeConnection({ failOnSetsRead: true }));
    throw new Error('Test 6 failed: expected read failure to throw');
  } catch (error: any) {
    if (!error.message.includes('MANIFEST_HEALTH_CHECK_FAILED')) throw error;
  }

  console.log('[Equinox] Active V2 runtime manifest health validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
