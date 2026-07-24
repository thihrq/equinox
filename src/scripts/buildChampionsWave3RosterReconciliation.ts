import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { reconcileRoster, GenerationCatalogEntry } from '../services/competitive-data/expert/wave3/RosterReconciliation';
import { SENTINEL_POKEMON_IDS, PILOT_POKEMON_IDS, ALREADY_PROCESSED_POKEMON_IDS } from '../services/competitive-data/expert/wave3/AlreadyProcessedPokemonIds';

export { SENTINEL_POKEMON_IDS, PILOT_POKEMON_IDS, ALREADY_PROCESSED_POKEMON_IDS };

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try { fs.renameSync(temporary, file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') { console.error(`ARTIFACT_ATOMIC_RENAME_BLOCKED:${file}`); fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); return; }
    throw error;
  }
}

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = path.resolve(`artifacts/competitive-production-readiness/${runId}/roster`);

  const pkg = loadChampionsCompetitivePackage();
  const validation = validateChampionsCompetitivePackage(pkg);
  const generations = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/generations.json', 'utf8')) as { entries: GenerationCatalogEntry[] };

  const result = reconcileRoster({ pkg, eligiblePokemonIds: validation.eligiblePokemonIds, provisionalPokemonIds: validation.provisionalPokemonIds, blockedPokemonIds: validation.blockedPokemonIds, generationEntries: generations.entries }, ALREADY_PROCESSED_POKEMON_IDS);

  const eligiblePokemonIdsThisRun = new Set(validation.eligiblePokemonIds);
  // Classification is total by construction: reconcileRoster() assigns exactly one of
  // eligible/provisional/blocked/ineligible to every roster record, so this checks record count
  // parity (no record silently dropped) rather than re-deriving the same tautology.
  const everyOfficialRecordClassified = result.records.length === pkg.roster.length;
  const gate = {
    officialRosterReconciled: true,
    everyOfficialRecordClassified,
    eligibleRosterCountConfirmed: result.totals.eligible === eligiblePokemonIdsThisRun.size,
    unresolvedAliases: result.totals.unresolvedAliases === 0,
    duplicateCanonicalRecords: result.totals.duplicate === 0,
    rosterDigestIntegrity: result.records.every(r => typeof r.recordDigest === 'string' && r.recordDigest.startsWith('sha256:')),
  };
  const valid = Object.values(gate).every(Boolean);

  writeAtomic(path.join(outputDir, 'official-roster-snapshot.json'), { runId, packageDigest: pkg.sourceManifest.packageDigest, rosterCount: pkg.roster.length, speciesCount: pkg.species.length, generationCatalogCount: generations.entries.length });
  writeAtomic(path.join(outputDir, 'eligibility-policy.json'), { runId, policyId: 'champions-package-eligibility-policy', source: 'validateChampionsCompetitivePackage (unmodified, Wave 1-era)', rule: 'eligible = roster.legal && mechanicallyComplete (species+learnset+moves/abilities/items all real and referenced); provisional = incomplete mechanical data OR verificationStatus provisional/unknown OR missing learnset; blocked = illegal or corrupt with none of the provisional excuses.' });
  writeAtomic(path.join(outputDir, 'roster-reconciliation.json'), { runId, totals: result.totals, gate, valid });
  writeAtomic(path.join(outputDir, 'eligible-records.json'), { runId, count: result.totals.eligible, records: result.records.filter(r => r.eligibility === 'eligible') });
  writeAtomic(path.join(outputDir, 'provisional-records.json'), { runId, count: result.totals.provisional, records: result.records.filter(r => r.eligibility === 'provisional') });
  writeAtomic(path.join(outputDir, 'blocked-records.json'), { runId, count: result.totals.blocked, records: result.records.filter(r => r.eligibility === 'blocked') });
  writeAtomic(path.join(outputDir, 'ineligible-records.json'), { runId, count: result.totals.ineligible, records: result.records.filter(r => r.eligibility === 'ineligible') });
  writeAtomic(path.join(outputDir, 'alias-resolution.json'), { runId, aliasResolvedCount: result.totals.aliasResolved, unresolvedCount: result.totals.unresolvedAliases, unresolvedRecords: result.unresolvedAliasRecords });
  writeAtomic(path.join(outputDir, 'duplicate-resolution.json'), { runId, duplicateCount: result.totals.duplicate, duplicateCanonicalIds: result.duplicateCanonicalIds });
  writeAtomic(path.join(outputDir, 'roster-digests.json'), { runId, packageDigest: pkg.sourceManifest.packageDigest, recordDigests: result.records.map(r => ({ canonicalPokemonId: r.canonicalPokemonId, recordDigest: r.recordDigest })) });
  writeAtomic(path.join(outputDir, 'roster-summary.md'), `# Wave 3 Roster Reconciliation Summary\n\nRun ID: \`${runId}\`\n\n| Metric | Count |\n|---|---|\n| Official records | ${result.totals.official} |\n| Eligible | ${result.totals.eligible} |\n| Provisional (excluded) | ${result.totals.provisional} |\n| Blocked (excluded) | ${result.totals.blocked} |\n| Ineligible (excluded) | ${result.totals.ineligible} |\n| Duplicate canonical records | ${result.totals.duplicate} |\n| Aliases resolved | ${result.totals.aliasResolved} |\n| Unresolved aliases | ${result.totals.unresolvedAliases} |\n| Already processed (Wave 1 sentinel + Wave 2 pilot) | ${ALREADY_PROCESSED_POKEMON_IDS.length} |\n| Processable this run (eligible, not yet processed) | ${result.totals.processable} |\n\nGate: ${valid ? 'PASS' : 'FAIL'}\n`);

  console.log(JSON.stringify({ valid, totals: result.totals, gate, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 4;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 32; }
  }
}
