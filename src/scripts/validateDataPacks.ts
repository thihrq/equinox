import { DataPackRegistry } from '../equinox/data-packs/DataPackRegistry';
import setsDataPack from '../equinox/data-packs/sets-data-pack.json';
import { buildCompetitiveDataQualityReport } from '../equinox/data-audit/CompetitiveDataQualityReport';

const report = new DataPackRegistry().buildReport();
const quality = buildCompetitiveDataQualityReport({
  sets: setsDataPack.sets.map((set, index) => ({
    setId: `${set.formatId}:${set.pokemonName}:${index}`,
    pokemonId: set.pokemonName,
    formId: set.pokemonName,
    regulationId: set.formatId,
    battleStyle: set.formatId.includes('champions') ? 'doubles' : 'singles',
    legal: true,
    status: 'draft',
    confidence: 30,
    coherenceScore: 50,
    primaryRole: set.role,
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    evs: set.evs,
    ivs: {},
    moves: set.moves,
    sourceId: 'equinox-legacy-sets-pack',
    sourceType: 'fallback',
  })),
});

console.log(`[Equinox] Data packs: total=${report.totalPacks} confidence=${report.confidence}/100 status=${report.overallStatus}`);
console.log(`[Equinox] Data packs by kind: ${JSON.stringify(report.packsByKind)}`);
console.log(
  `[Equinox] Competitive data quality: total=${quality.totalSets} legal=${quality.legalPercent}% ` +
    `avgConfidence=${quality.averageConfidence} avgCoherence=${quality.averageCoherence} duplicates=${quality.duplicateGroups}`,
);

for (const manifest of report.manifests) {
  const issueCount = manifest.validation.errors.length + manifest.validation.warnings.length;
  console.log(
    `[${manifest.validation.status.toUpperCase()}] ${manifest.id} | ${manifest.status} | records=${manifest.recordCount} | issues=${issueCount}`,
  );

  for (const error of manifest.validation.errors) {
    console.error(`  error: ${error}`);
  }

  for (const warning of manifest.validation.warnings.slice(0, 3)) {
    console.warn(`  warning: ${warning}`);
  }
}

if (report.failingPacks.length > 0) {
  console.error(`[Equinox] Data pack validation failed: ${report.failingPacks.join(', ')}`);
  throw new Error(`Data pack validation failed: ${report.failingPacks.join(', ')}`);
}
