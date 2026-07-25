// Wave 3 -- Fase F. Builds the immutable, validated-only package: EXCLUSIVELY candidates whose
// real verdict is expert-validated (per FullRosterExpansionPolicy.packageInclusionPolicy, the
// single source of truth already guarded by assertFullRosterExpansionPolicyConsistency), plus a
// complete exclusion report for every other outcome. Read-only over consolidated/* -- never
// promotes anything to Mongo/production, never mutates prior-wave artifacts.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FULL_ROSTER_EXPANSION_POLICY } from '../services/competitive-data/expert/wave3/FullRosterExpansionPolicy';

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
const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

interface DraftLike { setId: string; pokemonId: string; source: string; [key: string]: unknown; }
interface VerdictLike { setId: string; pokemonId: string; verdict: string; reasonCodes: string[]; source: string; [key: string]: unknown; }
interface RosterRecord { canonicalPokemonId: string; reasonCodes: string[]; recordDigest: string; }

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const consolidatedDir = path.join(runDir, 'consolidated');
  if (!fs.existsSync(path.join(consolidatedDir, 'all-candidates.json'))) fail('Missing consolidated artifacts -- run sets:champions:expansion:full:consolidate first', 12);

  const allDrafts = (JSON.parse(fs.readFileSync(path.join(consolidatedDir, 'all-candidates.json'), 'utf8')).drafts as DraftLike[]);
  const allVerdicts = (JSON.parse(fs.readFileSync(path.join(consolidatedDir, 'all-verdicts.json'), 'utf8')).verdicts as VerdictLike[]);
  const noLegalCandidateSpecies = (JSON.parse(fs.readFileSync(path.join(consolidatedDir, 'no-legal-candidate-species.json'), 'utf8')).species as Array<{ pokemonId: string; reason: string }>);
  const provisionalRecords = (JSON.parse(fs.readFileSync(path.join(runDir, 'roster', 'provisional-records.json'), 'utf8')).records as RosterRecord[]);
  const blockedRecords = (JSON.parse(fs.readFileSync(path.join(runDir, 'roster', 'blocked-records.json'), 'utf8')).records as RosterRecord[]);
  const ineligibleRecords = (JSON.parse(fs.readFileSync(path.join(runDir, 'roster', 'ineligible-records.json'), 'utf8')).records as RosterRecord[]);
  const totalRosterRecords = (JSON.parse(fs.readFileSync(path.join(runDir, 'roster', 'roster-reconciliation.json'), 'utf8')).totals as { official: number }).official;

  const draftBySetId = new Map(allDrafts.map(d => [d.setId, d]));
  const includedVerdicts = new Set(FULL_ROSTER_EXPANSION_POLICY.packageInclusionPolicy.includedVerdicts);

  const includedCandidates = allVerdicts.filter(v => includedVerdicts.has(v.verdict as never));
  const excludedCandidates = allVerdicts.filter(v => !includedVerdicts.has(v.verdict as never));

  const entries = includedCandidates.map(v => {
    const draft = draftBySetId.get(v.setId);
    if (!draft) fail(`INVARIANT_VIOLATION: expert-validated verdict ${v.setId} has no matching draft`, 32);
    const { source: _draftSource, ...draftFields } = draft;
    const entryDigest = digest({ setId: v.setId, pokemonId: v.pokemonId, verdict: v.verdict, draft: draftFields });
    return { setId: v.setId, pokemonId: v.pokemonId, formatId: FULL_ROSTER_EXPANSION_POLICY.formatId, regulationId: FULL_ROSTER_EXPANSION_POLICY.regulationId, verdict: v.verdict, confidence: v.confidence, sourceWave: draft.source, set: draftFields, entryDigest };
  }).sort((a, b) => a.entryDigest.localeCompare(b.entryDigest));

  const duplicateEntryDigests = entries.map(e => e.entryDigest).filter((d, i, arr) => arr.indexOf(d) !== i);
  const entryDigests = entries.map(e => e.entryDigest);
  const packageDigest = digest({ policyVersion: FULL_ROSTER_EXPANSION_POLICY.policyVersion, entryDigests });

  const excludedCandidatesReport = excludedCandidates.map(v => ({ setId: v.setId, pokemonId: v.pokemonId, verdict: v.verdict, reasonCodes: v.reasonCodes, sourceWave: v.source, retryable: false }));
  const excludedSpeciesReport = [
    ...noLegalCandidateSpecies.map(s => ({ pokemonId: s.pokemonId, reasonCode: 'NO_LEGAL_CANDIDATE_GENERATED', reason: s.reason, retryable: false })),
    ...provisionalRecords.map(r => ({ pokemonId: r.canonicalPokemonId, reasonCode: 'SPECIES_PROVISIONAL_EXCLUDED_FROM_EXPANSION', reason: r.reasonCodes.join(','), retryable: true })),
    ...blockedRecords.map(r => ({ pokemonId: r.canonicalPokemonId, reasonCode: 'SPECIES_BLOCKED_EXCLUDED_FROM_EXPANSION', reason: r.reasonCodes.join(','), retryable: false })),
    ...ineligibleRecords.map(r => ({ pokemonId: r.canonicalPokemonId, reasonCode: 'SPECIES_INELIGIBLE_EXCLUDED_FROM_EXPANSION', reason: r.reasonCodes.join(','), retryable: false })),
  ];

  const includedSpeciesCount = new Set(entries.map(e => e.pokemonId)).size;
  const speciesWithOnlyExcludedCandidates = [...new Set(excludedCandidates.map(v => v.pokemonId))].filter(id => !entries.some(e => e.pokemonId === id));

  const manifest = {
    runId, packageId: 'champions-wave3-validated-package', packageVersion: FULL_ROSTER_EXPANSION_POLICY.policyVersion,
    policyId: FULL_ROSTER_EXPANSION_POLICY.policyId, policyVersion: FULL_ROSTER_EXPANSION_POLICY.policyVersion,
    formatId: FULL_ROSTER_EXPANSION_POLICY.formatId, regulationId: FULL_ROSTER_EXPANSION_POLICY.regulationId,
    entryCount: entries.length, includedSpeciesCount, entryDigests, packageDigest, duplicateEntryDigestCount: duplicateEntryDigests.length,
    immutable: true,
  };

  writeAtomic(path.join(runDir, 'validated-package', 'entries.json'), { runId, entryCount: entries.length, entries });
  writeAtomic(path.join(runDir, 'validated-package', 'manifest.json'), manifest);
  writeAtomic(path.join(runDir, 'validated-package', 'exclusion-report.json'), {
    runId, excludedCandidateCount: excludedCandidatesReport.length, excludedSpeciesCount: excludedSpeciesReport.length,
    speciesWithOnlyExcludedCandidatesCount: speciesWithOnlyExcludedCandidates.length,
    excludedCandidates: excludedCandidatesReport, excludedSpecies: excludedSpeciesReport,
  });
  writeAtomic(path.join(runDir, 'validated-package', 'index.json'), { runId, records: entries.map(e => ({ setId: e.setId, pokemonId: e.pokemonId, entryDigest: e.entryDigest })) });

  const accountedRosterRecords = includedSpeciesCount + speciesWithOnlyExcludedCandidates.length + excludedSpeciesReport.length;
  const valid = entries.length > 0 && duplicateEntryDigests.length === 0 && entries.every(e => e.verdict === 'expert-validated') && accountedRosterRecords === totalRosterRecords;

  console.log(JSON.stringify({ valid, entryCount: entries.length, includedSpeciesCount, excludedCandidateCount: excludedCandidatesReport.length, excludedSpeciesCount: excludedSpeciesReport.length, accountedRosterRecords, totalRosterRecords, packageDigest, duplicateEntryDigestCount: duplicateEntryDigests.length, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 16;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
