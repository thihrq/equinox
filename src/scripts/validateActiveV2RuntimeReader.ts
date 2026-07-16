import { readActiveV2ProductionState } from '../services/competitive-data/runtime-read/ActiveV2RuntimeReader';

function makeConnection(options: { activeSets?: any[]; activeManifest?: any | null }): { connection: any; requestedCollections: string[] } {
  const requestedCollections: string[] = [];
  const activeSets = options.activeSets ?? [];
  const activeManifest = options.activeManifest ?? null;

  const connection = {
    db: {
      collection: (name: string) => {
        requestedCollections.push(name);
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

  return { connection, requestedCollections };
}

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: mapeia registros corretamente ---
  const rawSet = {
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
    status: 'active',
    active: true,
  };
  const { connection: conn1 } = makeConnection({ activeSets: [rawSet], activeManifest: { setIds: [rawSet.setId] } });
  const result1 = await readActiveV2ProductionState(conn1);
  if (result1.records.length !== 1) throw new Error('Test 1 failed: expected 1 record');
  if (result1.records[0].setId !== rawSet.setId) throw new Error('Test 1 failed: expected setId to be mapped');
  if (result1.records[0].moves?.length !== 4) throw new Error('Test 1 failed: expected 4 moves to be mapped');

  // --- Caso de Teste 2: NUNCA solicita a coleção legada "pokemonsets" ---
  const { connection: conn2, requestedCollections } = makeConnection({ activeSets: [rawSet], activeManifest: null });
  await readActiveV2ProductionState(conn2);
  if (requestedCollections.includes('pokemonsets')) {
    throw new Error('Test 2 failed: reader must never request the legacy pokemonsets collection');
  }
  if (!requestedCollections.includes('pokemonsets_v2') || !requestedCollections.includes('publication_manifests')) {
    throw new Error('Test 2 failed: expected exactly pokemonsets_v2 and publication_manifests to be requested');
  }

  // --- Caso de Teste 3: manifesto ausente retorna activeManifest=null sem lançar ---
  const { connection: conn3 } = makeConnection({ activeSets: [], activeManifest: null });
  const result3 = await readActiveV2ProductionState(conn3);
  if (result3.activeManifest !== null) throw new Error('Test 3 failed: expected null manifest to be preserved');
  if (result3.records.length !== 0) throw new Error('Test 3 failed: expected zero records');

  console.log('[Equinox] Active V2 runtime reader validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
