import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { generateDrafts, validateDrafts, digest } from '../services/competitive-data/curation/CompetitiveCurationCore';
import { CurationConfig, CurationSetDraft, SentinelSelection } from '../services/competitive-data/curation/CompetitiveCurationTypes';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try { fs.renameSync(temporary, file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') { console.error(`ARTIFACT_ATOMIC_RENAME_BLOCKED:${file}`); fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); return; }
    throw error;
  }
}

const INSUFFICIENT_MOVES_PREFIX = 'INSUFFICIENT_LEARNSET_MOVES:';

/**
 * Reuses the real, already-generic generateDrafts() unmodified. It throws synchronously (naming
 * the failing pokemonId) if a selected species has fewer than 4 legal moves -- rather than forcing
 * a fabricated set, this loop removes that one species and retries, logging why (mission section
 * 23: "quando dois candidates legais nao forem possiveis... nao inventar; registrar motivo").
 */
function generateDraftsWithGracefulSkipping(config: CurationConfig, selection: SentinelSelection): { drafts: CurationSetDraft[]; skipped: { pokemonId: string; reason: string }[] } {
  let workingIds = [...selection.selectedPokemonIds];
  const skipped: { pokemonId: string; reason: string }[] = [];
  for (let attempt = 0; attempt < workingIds.length + 1; attempt += 1) {
    try {
      const drafts = generateDrafts(config, { ...selection, selectedPokemonIds: workingIds });
      return { drafts, skipped };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith(INSUFFICIENT_MOVES_PREFIX)) throw error;
      const failingId = message.slice(INSUFFICIENT_MOVES_PREFIX.length);
      if (!workingIds.includes(failingId)) throw error;
      skipped.push({ pokemonId: failingId, reason: message });
      workingIds = workingIds.filter(id => id !== failingId);
    }
  }
  return { drafts: [], skipped };
}

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = path.resolve(`artifacts/competitive-production-readiness/${runId}/pilot`);

  const selectedPath = path.join(outputDir, 'selected-pokemon.json');
  if (!fs.existsSync(selectedPath)) fail(`Pilot selection not found -- run sets:champions:expansion:pilot:select first: ${selectedPath}`, 12);
  const selectedRecords = JSON.parse(fs.readFileSync(selectedPath, 'utf8')).records as Array<{ pokemonId: string }>;

  const pkg = loadChampionsCompetitivePackage();
  const config: CurationConfig = { snapshotId: `wave2-pilot-${runId}`, regulationId: 'M-B', pokemonLimit: selectedRecords.length, candidatesPerPokemon: 2, seed: `wave2-pilot-${runId}`, packageDigest: pkg.sourceManifest.packageDigest, package: pkg };
  const selection: SentinelSelection = { sentinelRunId: `wave2-pilot-${runId}`, snapshotId: config.snapshotId, regulationId: 'M-B', packageDigest: config.packageDigest, eligiblePoolDigest: digest(selectedRecords.map(r => r.pokemonId)), seed: config.seed, policyVersion: 'wave2-pilot-candidate-generation-v1', selectedPokemonIds: selectedRecords.map(r => r.pokemonId), representedCategories: [], missingCategories: [], blockers: [], warnings: [] };

  const { drafts, skipped } = generateDraftsWithGracefulSkipping(config, selection);
  const reviews = validateDrafts(config, drafts);
  const reviewBySetId = new Map(reviews.map(r => [r.setId, r]));
  const legalDrafts = drafts.filter(d => reviewBySetId.get(d.setId)?.legal);
  const illegalDrafts = drafts.filter(d => !reviewBySetId.get(d.setId)?.legal);

  // Materially-distinct-proposal check (mission section 23): offset-0 drafts are offensive-EV
  // (declaredRoles includes 'damage-dealer'), offset-1 are bulky/support-EV ('support') -- this is
  // structural to generateDrafts()'s existing, unmodified EV-spread policy, verified here rather
  // than re-implemented.
  const perPokemon = new Map<string, CurationSetDraft[]>();
  for (const draft of drafts) perPokemon.set(draft.pokemonId, [...(perPokemon.get(draft.pokemonId) ?? []), draft]);
  const materiallyDistinctCount = [...perPokemon.values()].filter(group => group.length === 2 && group[0].declaredRoles.join(',') !== group[1].declaredRoles.join(',')).length;

  writeAtomic(path.join(outputDir, 'candidates.json'), { runId, totalGenerated: drafts.length, legalCount: legalDrafts.length, illegalCount: illegalDrafts.length, skippedSpecies: skipped, drafts, reviews });
  writeAtomic(path.join(outputDir, 'candidate-digests.json'), { runId, digests: drafts.map(d => ({ setId: d.setId, candidateDigest: d.provenance.candidateDigest, inputDigest: d.provenance.inputDigest })) });

  const distinctSpecies = new Set(drafts.map(d => d.pokemonId)).size;
  const valid = drafts.length > 0 && drafts.length <= 40 && legalDrafts.length === drafts.length && distinctSpecies === selectedRecords.length - skipped.length;
  console.log(JSON.stringify({ valid, totalGenerated: drafts.length, legalCount: legalDrafts.length, illegalCount: illegalDrafts.length, skippedSpeciesCount: skipped.length, distinctSpecies, materiallyDistinctPairCount: materiallyDistinctCount, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 12;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
