declare const require: (moduleName: string) => any;

const fs = require('fs') as any;
const os = require('os') as any;
const path = require('path') as any;
import { importChampionsOfficialRoster, OFFICIAL_ROSTER_ERRORS } from '../equinox/data-import/champions/sources/ChampionsOfficialRosterSource';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equinox-champions-source-'));
const write = (name: string, value: unknown): string => {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
  return filePath;
};

try {
  const officialRoster = write('roster.json', { pokemon: [{ name: 'Mawile-Mega' }, { name: 'Mega Mawile' }] });
  let duplicateBlocked = false;
  try { importChampionsOfficialRoster(officialRoster); } catch (error) { duplicateBlocked = String(error).includes(OFFICIAL_ROSTER_ERRORS.duplicate); }
  assert(duplicateBlocked, 'duplicate normalized roster IDs must be blocked');

  const emptyRoster = write('empty.json', { pokemon: [] });
  let emptyBlocked = false;
  try { importChampionsOfficialRoster(emptyRoster); } catch (error) { emptyBlocked = String(error).includes(OFFICIAL_ROSTER_ERRORS.empty); }
  assert(emptyBlocked, 'empty official roster must be blocked');

  const invalidStructure = write('invalid.json', { html: '<title>error</title>' });
  let structureBlocked = false;
  try { importChampionsOfficialRoster(invalidStructure); } catch (error) { structureBlocked = String(error).includes(OFFICIAL_ROSTER_ERRORS.structure); }
  assert(structureBlocked, 'unexpected official page structure must be blocked');

  const partial = validateChampionsCompetitivePackage({
    regulation: {
      formatId: 'champions_reg_m_b_doubles', regulationId: 'M-B', battleType: 'doubles',
      validFrom: '2026-06-17', validUntil: '2026-09-02', itemClause: true,
      maxMegaEvolutionsPerBattle: 1, teamSize: 6, bringCount: 4, schemaVersion: '1',
    },
    roster: [{
      pokemonId: 'mawile', speciesId: 'mawile', displayName: 'Mawile', legal: true,
      regulationId: 'M-B', verificationStatus: 'provisional', sourceEvidence: [{
        field: 'roster', authority: 'official', sourceId: 'fixture', sourceDigest: 'sha256:fixture',
        retrievedAt: '2026-07-19T00:00:00.000Z',
      }],
    }],
    species: [], moves: [], abilities: [], items: [], learnsets: [],
    restrictions: { itemClause: true, maxMegaEvolutionsPerBattle: 1, restrictedItems: [], bannedCombinations: [] },
    sourceManifest: {
      packageId: 'fixture', packageVersion: 'fixture', status: 'pending', generatedAt: '2026-07-19',
      sources: [{ sourceId: 'fixture', authority: 'official', url: 'fixture', retrievedAt: '2026-07-19', digest: 'sha256:fixture', scope: ['roster'] }],
      packageDigest: 'fixture',
    },
  });
  assert(partial.packageState === 'partial', 'roster-only package must be partial');
  assert(partial.generationEligible === false, 'roster-only package cannot generate');
  assert(partial.provisionalPokemonIds.includes('mawile'), 'roster-only entry must be provisional');
  console.log('[Equinox] Champions source contract test passed.');
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
