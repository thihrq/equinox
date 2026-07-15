import { validateLineageAndDigest } from '../services/competitive-data/publication/ActiveV2ProductionLineageValidator';
import { calculateCanonicalActiveV2DataDigest } from '../services/competitive-data/digest/ActiveV2CanonicalDataDigest';

function runLineageTests(): void {
  const mockStagingRecords = [
    { setId: 'set-1', pokemonName: 'pikachu', moves: ['thunderbolt'], roles: ['sweeper'], tags: ['fast'], item: 'light-ball', ability: 'static', nature: 'jolly', role: 'sweeper', synergyTags: ['fast'] },
    { setId: 'set-2', pokemonName: 'eevee', moves: ['quick-attack'], roles: ['helper'], tags: ['cute'], item: 'eviolite', ability: 'adaptability', nature: 'bold', role: 'helper', synergyTags: ['cute'] },
  ];

  const validDigest = calculateCanonicalActiveV2DataDigest(mockStagingRecords);

  const baseValidReport = {
    gateStatus: 'approved',
    automaticRolloutApproved: true,
    activeV2DataDigestAlgorithm: 'active-v2-canonical-sha256-v1',
    activeV2DataDigest: validDigest,
    activeV2RecordCount: 2,
    inputActiveRunId: 'run-123',
    baselineSourceDigest: 'sha256-baseline123',
  };

  // Teste 1: Linhagem válida (deve passar sem erros)
  validateLineageAndDigest(mockStagingRecords, baseValidReport);

  // Teste 2: Rejeição por gateStatus !== approved
  try {
    validateLineageAndDigest(mockStagingRecords, { ...baseValidReport, gateStatus: 'rejected' });
    throw new Error('Test 2 failed: Expected error for rejected gateStatus');
  } catch (error: any) {
    if (!error.message.includes('LINEAGE_VALIDATION_FAILED')) throw error;
  }

  // Teste 3: Rejeição por automaticRolloutApproved !== true
  try {
    validateLineageAndDigest(mockStagingRecords, { ...baseValidReport, automaticRolloutApproved: false });
    throw new Error('Test 3 failed: Expected error for automaticRolloutApproved = false');
  } catch (error: any) {
    if (!error.message.includes('LINEAGE_VALIDATION_FAILED')) throw error;
  }

  // Teste 4: Rejeição por digest do staging divergente
  try {
    validateLineageAndDigest(mockStagingRecords, { ...baseValidReport, activeV2DataDigest: 'sha256-differentdigest' });
    throw new Error('Test 4 failed: Expected error for digest mismatch');
  } catch (error: any) {
    if (!error.message.includes('LINEAGE_VALIDATION_FAILED')) throw error;
  }

  // Teste 5: Rejeição por contagem de registros divergente
  try {
    validateLineageAndDigest(mockStagingRecords, { ...baseValidReport, activeV2RecordCount: 10 });
    throw new Error('Test 5 failed: Expected error for recordCount mismatch');
  } catch (error: any) {
    if (!error.message.includes('LINEAGE_VALIDATION_FAILED')) throw error;
  }

  // Teste 6: Rejeição por algoritmo incompatível
  try {
    validateLineageAndDigest(mockStagingRecords, { ...baseValidReport, activeV2DataDigestAlgorithm: 'md5' });
    throw new Error('Test 6 failed: Expected error for incompatible algorithm');
  } catch (error: any) {
    if (!error.message.includes('LINEAGE_VALIDATION_FAILED')) throw error;
  }

  console.log('[Equinox] Active V2 production lineage validation passed.');
}

runLineageTests();
