import { homologateActiveV2RuntimeRead } from '../services/competitive-data/runtime-read/ActiveV2RuntimeReadHomologationValidator';
import { calculateCanonicalActiveV2DataDigest } from '../services/competitive-data/digest/ActiveV2CanonicalDataDigest';

function makeConnection(options: { activeSets?: any[]; activeManifest?: any | null }): any {
  const activeSets = options.activeSets ?? [];
  const activeManifest = options.activeManifest ?? null;

  return {
    db: {
      collection: (name: string) => {
        if (name === 'pokemonsets_v2') {
          return { find: () => ({ toArray: async () => activeSets }) };
        }
        if (name === 'publication_manifests') {
          return { findOne: async () => activeManifest };
        }
        throw new Error(`unexpected collection requested: ${name}`);
      },
    },
  };
}

const VALID_SET = {
  setId: 'sinistcha-bulky-trick-room-setter-draft',
  pokemonName: 'Sinistcha',
  formId: 'sinistcha',
  formatId: 'champions_reg_m_b_doubles',
  regulationId: 'champions_reg_m_b_doubles',
  battleStyle: 'doubles',
  item: 'Sitrus Berry',
  ability: 'Hospitality',
  nature: 'Sassy',
  evs: { hp: 252, atk: 0, def: 100, spa: 0, spd: 156, spe: 0 },
  ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 0 },
  moves: ['Trick Room', 'Rage Powder', 'Matcha Gotcha', 'Protect'],
  sourceId: 'equinox-curated-champions-mb-doubles',
  dataVersion: '2026.07.1',
  confidence: 84,
  status: 'active',
  active: true,
};

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: cenário saudável é aprovado ---
  const healthyDigest = calculateCanonicalActiveV2DataDigest([VALID_SET]);
  const healthyConn = makeConnection({
    activeSets: [VALID_SET],
    activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: healthyDigest, recordCount: 1, setIds: [VALID_SET.setId] },
  });
  const healthyResult = await homologateActiveV2RuntimeRead(healthyConn, 'active-v2-read');
  if (!healthyResult.approved) throw new Error(`Test 1 failed: expected healthy scenario to be approved, issues: ${JSON.stringify(healthyResult.recordIssues)}`);
  if (healthyResult.recordCount !== 1) throw new Error('Test 1 failed: expected recordCount 1');

  // --- Caso de Teste 2: registro com schema inválido é rejeitado ---
  const invalidSet = { ...VALID_SET, moves: ['Trick Room', 'Protect'] };
  const invalidDigest = calculateCanonicalActiveV2DataDigest([invalidSet]);
  const invalidConn = makeConnection({
    activeSets: [invalidSet],
    activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: invalidDigest, recordCount: 1, setIds: [invalidSet.setId] },
  });
  const invalidResult = await homologateActiveV2RuntimeRead(invalidConn, 'active-v2-read');
  if (invalidResult.approved) throw new Error('Test 2 failed: expected invalid schema to be rejected');
  if (!invalidResult.recordIssues.some(issue => issue.reason === 'SCHEMA_INVALID')) {
    throw new Error('Test 2 failed: expected SCHEMA_INVALID issue');
  }

  // --- Caso de Teste 3: setId listado no manifesto mas ausente entre os ativos (fallback silencioso) ---
  const incompleteConn = makeConnection({
    activeSets: [VALID_SET],
    activeManifest: { publishRunId: 'run-1', status: 'active', activeV2DataDigest: healthyDigest, recordCount: 1, setIds: [VALID_SET.setId, 'missing-set-draft'] },
  });
  const incompleteResult = await homologateActiveV2RuntimeRead(incompleteConn, 'active-v2-read');
  if (incompleteResult.approved) throw new Error('Test 3 failed: expected incomplete active set to be rejected');
  if (!incompleteResult.recordIssues.some(issue => issue.reason === 'INCOMPLETE_ACTIVE_SET' && issue.setId === 'missing-set-draft')) {
    throw new Error('Test 3 failed: expected INCOMPLETE_ACTIVE_SET issue for missing-set-draft');
  }

  // --- Caso de Teste 4: problema de saúde do manifesto (zero sets ativos) é rejeitado ---
  const zeroSetsConn = makeConnection({ activeSets: [], activeManifest: null });
  const zeroSetsResult = await homologateActiveV2RuntimeRead(zeroSetsConn, 'active-v2-read');
  if (zeroSetsResult.approved) throw new Error('Test 4 failed: expected zero active sets to be rejected');
  if (!zeroSetsResult.recordIssues.some(issue => issue.reason === 'MANIFEST_HEALTH_ISSUE')) {
    throw new Error('Test 4 failed: expected MANIFEST_HEALTH_ISSUE');
  }

  // --- Caso de Teste 5: modo baseline-only é aprovado trivialmente, sem tocar na conexão ---
  const baselineResult = await homologateActiveV2RuntimeRead(null, 'baseline-only');
  if (!baselineResult.approved) throw new Error('Test 5 failed: expected baseline-only to be approved');
  if (baselineResult.recordCount !== 0 || baselineResult.manifestHealth !== null) {
    throw new Error('Test 5 failed: expected baseline-only to have zero interaction with Active V2');
  }

  // --- Caso de Teste 6: active-v2-read sem conexão lança erro explícito ---
  try {
    await homologateActiveV2RuntimeRead(null, 'active-v2-read');
    throw new Error('Test 6 failed: expected missing connection to throw');
  } catch (error: any) {
    if (!error.message.includes('RUNTIME_READ_FAILED')) throw error;
  }

  console.log('[Equinox] Active V2 runtime read homologation validator validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
