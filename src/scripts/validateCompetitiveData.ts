import { normalizeAbilityId, normalizeMoveId, normalizePokemonId } from '../equinox/data-normalization/CompetitiveDataNormalizer';
import { validateCompetitiveSetStructure } from '../equinox/data-validation/CompetitiveSetStructureValidator';
import { getCompetitiveDataSources } from '../equinox/data-sources/DataSourceCatalog';
import { buildAuditRuntimeReport, printAuditRuntimeReport, resetAuditRuntimeCounters } from '../equinox/data-audit/DataAuditRuntime';
import { FileSystemCompetitiveSetSource } from '../equinox/data-sources/CompetitiveSetSource';
import pilotManifest from '../equinox/data-packs/competitive/champions-reg-mb-doubles/manifest.json';
import pilotSets from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const sources = getCompetitiveDataSources();
resetAuditRuntimeCounters();

assert(normalizePokemonId('Iron-Hands') === 'ironhands', 'Iron-Hands must normalize to ironhands.');
assert(normalizePokemonId('Mega Aggron') === 'aggronmega', 'Mega Aggron must normalize to aggronmega.');
assert(normalizeMoveId('Trick Room') === 'trickroom', 'Trick Room must normalize to trickroom.');
assert(normalizeAbilityId('Swift Swim') === 'swiftswim', 'Swift Swim must normalize to swiftswim.');
assert(sources.length > 0, 'Competitive data sources must be cataloged.');
assert(sources.every(source => source.id && source.trustScore >= 0), 'Every data source must expose an id and trust score.');

const invalid = validateCompetitiveSetStructure({
  pokemonName: 'Aggron-Mega',
  formatId: 'champions_reg_m_b_doubles',
  item: 'Aggronite',
  ability: 'Filter',
  nature: 'Impish',
  evs: { hp: 252, def: 252, spd: 4 },
  moves: ['Body Press', 'Heavy Slam', 'Protect'],
});

assert(!invalid.valid, 'Incomplete competitive set must be invalid.');
assert(invalid.errors.some(error => error.code === 'MISSING_REGULATION'), 'Structure validator must require regulation.');
assert(invalid.errors.some(error => error.code === 'MISSING_FORM'), 'Structure validator must require form.');
assert(invalid.errors.some(error => error.code === 'INVALID_MOVE_COUNT'), 'Structure validator must require exactly four moves.');
assert(pilotManifest.recordCount === pilotSets.sets.length, 'Pilot manifest recordCount must match sets.json.');
assert(pilotManifest.status === 'draft', 'Pilot package must remain draft.');
assert(pilotSets.sets.every(set => set.regulationId === pilotManifest.regulationId), 'Pilot sets must match manifest regulationId.');

async function runFilesystemSourceCheck(): Promise<void> {
  const source = new FileSystemCompetitiveSetSource(
    'src/equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json',
    'local competitive package',
  );
  const loaded = await source.loadSets();
  printAuditRuntimeReport(buildAuditRuntimeReport([loaded.source]));
}

runFilesystemSourceCheck()
  .then(() => {
    console.log('[Equinox] Competitive data structure validation passed.');
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
