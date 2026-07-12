import setsDataPack from '../equinox/data-packs/sets-data-pack.json';
import { buildAuditRuntimeReport, printAuditRuntimeReport, resetAuditRuntimeCounters } from '../equinox/data-audit/DataAuditRuntime';
import { normalizeCompetitiveSetIdentity } from '../equinox/data-normalization/CompetitiveDataNormalizer';
import { validateCompetitiveSetStructure } from '../equinox/data-validation/CompetitiveSetStructureValidator';

resetAuditRuntimeCounters();
const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--publish');
const migrated = setsDataPack.sets.map((legacy, index) => {
  const identity = normalizeCompetitiveSetIdentity({
    pokemonName: legacy.pokemonName,
    formatId: legacy.formatId,
    moves: legacy.moves,
    item: legacy.item,
    ability: legacy.ability,
    nature: legacy.nature,
  });
  const record = {
    ...legacy,
    pokemonId: identity.pokemonId,
    formId: identity.formId,
    regulationId: legacy.formatId,
    battleStyle: legacy.formatId.includes('champions') ? 'doubles' as const : 'singles' as const,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    sourceId: 'equinox-legacy-sets-pack',
    sourceType: 'fallback',
    confidence: 30,
    importedAt: new Date().toISOString(),
    dataVersion: setsDataPack.version,
    setId: `${identity.formId}:${legacy.formatId}:${index}`,
    contentHash: stableHash(JSON.stringify(legacy)),
  };
  const validation = validateCompetitiveSetStructure(record);
  return {
    ...record,
    status: validation.valid ? 'draft' : 'quarantined',
    validationErrors: validation.errors.map(error => error.code),
    validationWarnings: validation.warnings.map(warning => warning.code),
  };
});

const report = {
  mode: dryRun ? 'dry-run' : 'publish',
  generatedAt: new Date().toISOString(),
  readCount: setsDataPack.sets.length,
  acceptedCount: migrated.filter(record => record.status !== 'quarantined').length,
  rejectedCount: 0,
  writtenCount: 0,
  mongoWrites: 0,
  read: setsDataPack.sets.length,
  staged: migrated.length,
  quarantined: migrated.filter(record => record.status === 'quarantined').length,
  activeWritten: 0,
  dryRun,
  note: 'Dry-run migration only. No MongoDB collection is overwritten by this script.',
};

if (dryRun) console.log('[DRY-RUN] Nenhuma alteracao sera persistida.');
console.log(JSON.stringify(report, null, 2));
printAuditRuntimeReport(buildAuditRuntimeReport([{
  type: 'file',
  path: 'src/equinox/data-packs/sets-data-pack.json',
  label: 'legacy sets data pack',
  recordCount: setsDataPack.sets.length,
}]));

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
