import { DataPackRegistry } from '../equinox/data-packs/DataPackRegistry';

const report = new DataPackRegistry().buildReport();

console.log(`[Equinox] Data packs: total=${report.totalPacks} confidence=${report.confidence}/100 status=${report.overallStatus}`);
console.log(`[Equinox] Data packs by kind: ${JSON.stringify(report.packsByKind)}`);

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
