import { normalizeChampionsId } from '../equinox/data-normalization/champions/ChampionsAliasNormalizer';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { validateChampionsSourceFreshness } from '../equinox/data-validation/champions/ChampionsSourceFreshnessValidator';
import { importChampionsCommunityCrosscheck } from '../equinox/data-import/champions/ImportChampionsCommunityCrosscheck';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(normalizeChampionsId('Mega Mawile') === 'mawile-mega', 'Mega Mawile normalization failed');
assert(normalizeChampionsId('Mawile-Mega') === 'mawile-mega', 'Mawile-Mega normalization failed');
assert(normalizeChampionsId('mawilemega') === 'mawile-mega', 'mawilemega normalization failed');

const result = validateChampionsCompetitivePackage({
  regulation: {
    formatId: 'champions_reg_m_b_doubles', regulationId: 'M-B', battleType: 'doubles',
    validFrom: '2026-06-17', validUntil: '2026-09-02', itemClause: true,
    maxMegaEvolutionsPerBattle: 1, teamSize: 6, bringCount: 4, schemaVersion: '1',
  },
  roster: [], species: [], moves: [], abilities: [], items: [], learnsets: [],
  restrictions: { itemClause: true, maxMegaEvolutionsPerBattle: 1, restrictedItems: [], bannedCombinations: [] },
  sourceManifest: { packageId: 'test', packageVersion: '1', status: 'pending', generatedAt: '2026-07-19', sources: [], packageDigest: 'fixture' },
});

assert(result.status === 'blocked', 'empty package must be blocked');
assert(result.packageState === 'empty', 'empty package must report empty state');
assert(result.rosterRecordsRead === 0 && result.learnsetRecordsRead === 0, 'empty package counters must be zero');
assert(result.generationEligible === false, 'empty package cannot generate');
const blockerCodes = new Set(result.blockers.map(item => item.code));
for (const code of [
  'ROSTER_SNAPSHOT_MISSING',
  'MOVE_CATALOG_MISSING',
  'ABILITY_CATALOG_MISSING',
  'ITEM_CATALOG_MISSING',
  'LEARNSET_SNAPSHOT_MISSING',
]) {
  assert(blockerCodes.has(code), `${code} blocker is required`);
}
assert(validateChampionsSourceFreshness([{ sourceId: 'fixture', retrievedAt: '2026-07-19T00:00:00.000Z' }], '2026-07-19T00:00:00.000Z').length === 0, 'fresh source should pass');
assert(importChampionsCommunityCrosscheck({ sourceId: 'community', differences: [] }).isAuthority === false, 'community source cannot be authority');
console.log('[Equinox] Champions package contract test passed.');
