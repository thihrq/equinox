import { calculateCanonicalActiveV2DataDigest } from '../services/competitive-data/digest/ActiveV2CanonicalDataDigest';

function runDigestTests(): void {
  const baseRecordA = {
    setId: 'set-a',
    pokemonId: 'pikachu',
    moves: ['thunderbolt', 'iron-tail', 'volt-tackle', 'protect'],
    roles: ['sweeper', 'lead'],
    tags: ['fast', 'offensive'],
    _id: 'mongo-id-1',
    createdAt: new Date('2026-07-15T12:00:00Z'),
    publishedAt: new Date('2026-07-15T12:00:00Z'),
    active: true,
  };

  const baseRecordB = {
    setId: 'set-b',
    pokemonId: 'charizard',
    moves: ['flamethrower', 'air-slash', 'solar-beam', 'roost'],
    roles: ['special-breaker'],
    tags: ['sun-abuser'],
    _id: 'mongo-id-2',
    createdAt: new Date('2026-07-15T12:00:00Z'),
    publishedAt: new Date('2026-07-15T12:00:00Z'),
    active: true,
  };

  // Teste 1: Digest base
  const digest1 = calculateCanonicalActiveV2DataDigest([baseRecordA, baseRecordB]);

  // Teste 2: Ordem dos documentos invertida no array de entrada (deve resultar no mesmo digest)
  const digest2 = calculateCanonicalActiveV2DataDigest([baseRecordB, baseRecordA]);
  if (digest1 !== digest2) {
    throw new Error('Test 2 failed: Document ordering altered the digest');
  }

  // Teste 3: Alteração de propriedades transitórias (deve resultar no mesmo digest)
  const recordAModifiedTransit = {
    ...baseRecordA,
    _id: 'different-mongo-id',
    createdAt: new Date('2026-07-16T18:00:00Z'),
    publishedAt: new Date('2026-07-16T18:00:00Z'),
    active: false,
    publishRunId: 'some-run-id',
  };
  const digest3 = calculateCanonicalActiveV2DataDigest([recordAModifiedTransit, baseRecordB]);
  if (digest1 !== digest3) {
    throw new Error('Test 3 failed: Transient fields altered the digest');
  }

  // Teste 4: Ordem das chaves do objeto diferente (deve resultar no mesmo digest)
  const recordBReorderedProps = {
    _id: 'mongo-id-2',
    active: true,
    roles: ['special-breaker'],
    moves: ['flamethrower', 'air-slash', 'solar-beam', 'roost'],
    setId: 'set-b',
    tags: ['sun-abuser'],
    pokemonId: 'charizard',
    publishedAt: new Date('2026-07-15T12:00:00Z'),
    createdAt: new Date('2026-07-15T12:00:00Z'),
  };
  const digest4 = calculateCanonicalActiveV2DataDigest([baseRecordA, recordBReorderedProps]);
  if (digest1 !== digest4) {
    throw new Error('Test 4 failed: Object key order altered the digest');
  }

  // Teste 5: Ordem diferente nos arrays de conteúdo (moves/roles/tags) (deve resultar no mesmo digest)
  const recordAAlternativeArrays = {
    ...baseRecordA,
    moves: ['iron-tail', 'protect', 'thunderbolt', 'volt-tackle'], // reordenado
    roles: ['lead', 'sweeper'], // reordenado
    tags: ['offensive', 'fast'], // reordenado
  };
  const digest5 = calculateCanonicalActiveV2DataDigest([recordAAlternativeArrays, baseRecordB]);
  if (digest1 !== digest5) {
    throw new Error('Test 5 failed: Content array ordering (moves/roles/tags) altered the digest');
  }

  // Teste 6: Mudança competitiva real (deve alterar o digest)
  const recordAModifiedCompetitive = {
    ...baseRecordA,
    moves: ['thunderbolt', 'iron-tail', 'volt-tackle', 'surf'], // 'protect' substituido por 'surf'
  };
  const digest6 = calculateCanonicalActiveV2DataDigest([recordAModifiedCompetitive, baseRecordB]);
  if (digest1 === digest6) {
    throw new Error('Test 6 failed: Competitive content change did not alter the digest');
  }

  console.log('[Equinox] Active V2 production digest validation passed.');
}

runDigestTests();
