import { calculateActiveV2CanaryBucket, isActiveV2CanarySelected } from '../services/competitive-data/runtime-control/ActiveV2CanarySelector';

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: determinístico (mesmo identifier+seed sempre produz o mesmo bucket) ---
  const bucketA1 = calculateActiveV2CanaryBucket('team-abc', 'seed-1');
  const bucketA2 = calculateActiveV2CanaryBucket('team-abc', 'seed-1');
  if (bucketA1 !== bucketA2) throw new Error('Test 1 failed: expected deterministic bucket for same identifier+seed');
  if (bucketA1 < 0 || bucketA1 > 99) throw new Error('Test 1 failed: expected bucket in range [0, 99]');

  // --- Caso de Teste 2: seeds diferentes tendem a produzir buckets diferentes (não determinístico em geral, mas não deve ser idêntico sempre) ---
  const identifiers = Array.from({ length: 50 }, (_, i) => `identifier-${i}`);
  const sameSeedResults = identifiers.some(id => calculateActiveV2CanaryBucket(id, 'seed-1') !== calculateActiveV2CanaryBucket(id, 'seed-2'));
  if (!sameSeedResults) throw new Error('Test 2 failed: expected different seeds to diverge for at least some identifiers');

  // --- Caso de Teste 3: propriedade cumulativa — selecionado em X% permanece selecionado em X+N% ---
  const seed = 'cumulative-seed';
  const selectedAt10 = identifiers.filter(id => isActiveV2CanarySelected(id, seed, 10));
  const selectedAt25 = identifiers.filter(id => isActiveV2CanarySelected(id, seed, 25));
  const allSelectedAt10AreSelectedAt25 = selectedAt10.every(id => selectedAt25.includes(id));
  if (!allSelectedAt10AreSelectedAt25) throw new Error('Test 3 failed: expected cumulative sampling (10% subset of 25%)');

  // --- Caso de Teste 4: 0% nunca seleciona, 100% sempre seleciona ---
  if (identifiers.some(id => isActiveV2CanarySelected(id, seed, 0))) throw new Error('Test 4 failed: expected 0% to select nobody');
  if (identifiers.some(id => !isActiveV2CanarySelected(id, seed, 100))) throw new Error('Test 4 failed: expected 100% to select everybody');

  // --- Caso de Teste 5: distribuição aproximada em uma amostra grande (não deve ser grosseiramente enviesada) ---
  const largeSample = Array.from({ length: 5000 }, (_, i) => `sample-${i}`);
  const selectedCountAt50 = largeSample.filter(id => isActiveV2CanarySelected(id, 'distribution-seed', 50)).length;
  const ratio = selectedCountAt50 / largeSample.length;
  if (ratio < 0.4 || ratio > 0.6) {
    throw new Error(`Test 5 failed: expected ~50% selection ratio on large sample, got ${(ratio * 100).toFixed(1)}%`);
  }

  console.log('[Equinox] Active V2 canary selector validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
