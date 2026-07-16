import { compareBaselineAndV2Set, classifyActiveV2ShadowComparisons } from '../services/competitive-data/runtime-shadow/ActiveV2ShadowSetComparator';
import type { ActiveV2ShadowSuggestedPokemon } from '../services/competitive-data/runtime-shadow/ActiveV2RuntimeShadowTypes';

const BASELINE: ActiveV2ShadowSuggestedPokemon = {
  name: 'Sinistcha',
  item: 'Sitrus Berry',
  ability: 'Hospitality',
  nature: 'Sassy',
  moves: ['Trick Room', 'Rage Powder', 'Matcha Gotcha', 'Protect'],
};

async function runTests(): Promise<void> {
  // --- Caso de Teste 1: sem set V2 -> no-v2-data ---
  const noData = compareBaselineAndV2Set(BASELINE, null);
  if (noData.outcome !== 'no-v2-data') throw new Error('Test 1 failed: expected no-v2-data when v2Set is null');

  // --- Caso de Teste 2: set idêntico (case/espaço insensível) -> match ---
  const identical = compareBaselineAndV2Set(BASELINE, {
    item: 'sitrus berry',
    ability: 'HOSPITALITY',
    nature: 'Sassy',
    moves: ['Protect', 'Matcha Gotcha', 'Trick Room', 'Rage Powder'], // ordem diferente
  });
  if (identical.outcome !== 'match') throw new Error(`Test 2 failed: expected match, got ${identical.outcome} (${identical.divergentFields.join(',')})`);

  // --- Caso de Teste 3: item diferente -> diverged com campo "item" ---
  const itemDiff = compareBaselineAndV2Set(BASELINE, { item: 'Mental Herb', ability: 'Hospitality', nature: 'Sassy', moves: BASELINE.moves });
  if (itemDiff.outcome !== 'diverged' || !itemDiff.divergentFields.includes('item')) {
    throw new Error('Test 3 failed: expected diverged with item field');
  }

  // --- Caso de Teste 4: moves diferentes -> diverged com campo "moves" ---
  const movesDiff = compareBaselineAndV2Set(BASELINE, { item: BASELINE.item, ability: BASELINE.ability, nature: BASELINE.nature, moves: ['Trick Room', 'Protect', 'Yawn', 'Scald'] });
  if (movesDiff.outcome !== 'diverged' || !movesDiff.divergentFields.includes('moves')) {
    throw new Error('Test 4 failed: expected diverged with moves field');
  }

  // --- Caso de Teste 5: classificação agregada -> todos match = equivalent, sem fallback ---
  const allMatch = classifyActiveV2ShadowComparisons([
    { pokemonName: 'A', outcome: 'match', divergentFields: [] },
    { pokemonName: 'B', outcome: 'match', divergentFields: [] },
  ]);
  if (allMatch.classification !== 'equivalent' || allMatch.fallbackTriggered) {
    throw new Error('Test 5 failed: expected equivalent with no fallback when all match');
  }

  // --- Caso de Teste 6: qualquer diverged/no-v2-data -> acceptable-divergence ---
  const someDiverged = classifyActiveV2ShadowComparisons([
    { pokemonName: 'A', outcome: 'match', divergentFields: [] },
    { pokemonName: 'B', outcome: 'diverged', divergentFields: ['item'] },
  ]);
  if (someDiverged.classification !== 'acceptable-divergence') throw new Error('Test 6 failed: expected acceptable-divergence');
  if (someDiverged.fallbackTriggered) throw new Error('Test 6 failed: expected fallbackTriggered=false (no no-v2-data present)');

  // --- Caso de Teste 7: no-v2-data dispara fallbackTriggered ---
  const withFallback = classifyActiveV2ShadowComparisons([
    { pokemonName: 'A', outcome: 'match', divergentFields: [] },
    { pokemonName: 'B', outcome: 'no-v2-data', divergentFields: [] },
  ]);
  if (!withFallback.fallbackTriggered) throw new Error('Test 7 failed: expected fallbackTriggered=true');
  if (withFallback.classification !== 'acceptable-divergence') throw new Error('Test 7 failed: expected acceptable-divergence when data is missing');

  console.log('[Equinox] Active V2 shadow set comparator validation passed.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
