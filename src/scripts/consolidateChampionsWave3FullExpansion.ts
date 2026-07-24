// Wave 3 -- Fase E consolidation. Combines Wave 2's already-approved 40 pilot candidates AND Wave
// 1's 20 sentinel candidates (both read-only reuse, never regenerated) with this run's 9 new
// batches (344 candidates across 173 species) into one consolidated view, with a real
// duplicate/coverage audit across all three sources.
//
// Correction (peer-review round 1 finding P1): an earlier version of this script incorrectly
// claimed no structured draft payload existed for the 10 Wave 1 sentinel species and excluded them
// under reasonCode SENTINEL_DRAFT_PAYLOAD_NOT_AVAILABLE. That claim was false -- the real drafts
// (moves/item/EVs/provenance) exist at artifacts/champions-curation/mb/champions-mb-sentinel-
// champions-mb-sentinel-v1/drafts.json, confirmed authentic by matching candidateDigest values
// byte-for-byte against artifacts/competitive-curation/champions-mb-sentinel-champions-mb-
// sentinel-v1/expert-validation/champions-mb-expert-validation-v1/final-expert-verdicts.json.
// They are now merged in like the pilot candidates. All 20 sentinel verdicts are
// expert-review-required (0 expert-validated), so this does not change the validated package's
// entry set -- it only completes the audit trail.
import fs from 'fs';
import path from 'path';
import { PILOT_POKEMON_IDS } from '../services/competitive-data/expert/wave3/AlreadyProcessedPokemonIds';

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

const PILOT_RUN_ID = '20260720T163228Z'; // Wave 2's approved pilot run -- read-only source, never modified.
const SENTINEL_DRAFTS_PATH = 'artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1/drafts.json';
const SENTINEL_VERDICTS_PATH = 'artifacts/competitive-curation/champions-mb-sentinel-champions-mb-sentinel-v1/expert-validation/champions-mb-expert-validation-v1/final-expert-verdicts.json';

interface DraftLike { setId: string; pokemonId: string; [key: string]: unknown; }
interface VerdictLike { setId: string; pokemonId: string; verdict: string; [key: string]: unknown; }
interface SentinelVerdictRaw { candidateId: string; candidateDigest: string; verdict: string; confidence: string; humanReviewRequirement: string; reasonCodes: string[]; evidenceDigest: string; }

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const pilotDir = path.resolve(`artifacts/competitive-production-readiness/${PILOT_RUN_ID}/pilot`);
  if (!fs.existsSync(path.join(pilotDir, 'candidates.json'))) fail(`Missing Wave 2 pilot source artifacts at ${pilotDir}`, 12);

  const batchPlan = JSON.parse(fs.readFileSync(path.join(runDir, 'planning', 'batch-plan.json'), 'utf8')) as { batches: Array<{ batchId: string }> };
  const pilotCandidates = JSON.parse(fs.readFileSync(path.join(pilotDir, 'candidates.json'), 'utf8')) as { drafts: DraftLike[] };
  const pilotVerdicts = JSON.parse(fs.readFileSync(path.join(pilotDir, 'verdicts.json'), 'utf8')) as { verdicts: VerdictLike[] };

  if (!fs.existsSync(SENTINEL_DRAFTS_PATH) || !fs.existsSync(SENTINEL_VERDICTS_PATH)) fail(`Missing Wave 1 sentinel source artifacts at ${SENTINEL_DRAFTS_PATH} / ${SENTINEL_VERDICTS_PATH}`, 12);
  const sentinelDrafts = JSON.parse(fs.readFileSync(SENTINEL_DRAFTS_PATH, 'utf8')) as DraftLike[];
  const sentinelVerdictsRaw = JSON.parse(fs.readFileSync(SENTINEL_VERDICTS_PATH, 'utf8')) as SentinelVerdictRaw[];
  const sentinelDraftBySetId = new Map(sentinelDrafts.map(d => [d.setId, d]));
  const sentinelVerdicts: VerdictLike[] = sentinelVerdictsRaw.map(v => {
    const draft = sentinelDraftBySetId.get(v.candidateId);
    if (!draft) fail(`INVARIANT_VIOLATION: sentinel verdict ${v.candidateId} has no matching draft in ${SENTINEL_DRAFTS_PATH}`, 32);
    return { setId: v.candidateId, pokemonId: draft.pokemonId, verdict: v.verdict, confidence: v.confidence, humanReviewRequirement: v.humanReviewRequirement, reasonCodes: v.reasonCodes, decisionTrace: [{ stage: 'wave1-sentinel-historical', note: 'Reused verbatim from Wave 1 final-expert-verdicts.json; not re-evaluated under the current policy since none of these 20 candidates are expert-validated.' }], source: 'wave1-sentinel' };
  });

  const allDrafts: DraftLike[] = [...sentinelDrafts.map(d => ({ ...d, source: 'wave1-sentinel' })), ...pilotCandidates.drafts.map(d => ({ ...d, source: 'wave2-pilot' }))];
  const allVerdicts: VerdictLike[] = [...sentinelVerdicts, ...pilotVerdicts.verdicts.map(v => ({ ...v, source: 'wave2-pilot' }))];
  const batchSourceCounts: Record<string, number> = { 'wave1-sentinel': sentinelDrafts.length, 'wave2-pilot': pilotCandidates.drafts.length };
  const allSkippedSpecies: Array<{ pokemonId: string; reason: string; batchId: string }> = [];

  for (const batch of batchPlan.batches) {
    const batchDir = path.join(runDir, 'batches', batch.batchId);
    const candidatesPath = path.join(batchDir, 'candidates.json');
    const verdictsPath = path.join(batchDir, 'verdicts.json');
    if (!fs.existsSync(candidatesPath) || !fs.existsSync(verdictsPath)) fail(`Batch ${batch.batchId} has not been run -- run sets:champions:expansion:full:run first`, 12);
    const candidatesFile = JSON.parse(fs.readFileSync(candidatesPath, 'utf8')) as { drafts: DraftLike[]; skippedSpecies: Array<{ pokemonId: string; reason: string }>; pokemonIds: string[] };
    const drafts = candidatesFile.drafts.map(d => ({ ...d, source: batch.batchId }));
    const verdicts = (JSON.parse(fs.readFileSync(verdictsPath, 'utf8')).verdicts as VerdictLike[]).map(v => ({ ...v, source: batch.batchId }));
    allDrafts.push(...drafts);
    allVerdicts.push(...verdicts);
    batchSourceCounts[batch.batchId] = drafts.length;
    for (const skipped of candidatesFile.skippedSpecies) allSkippedSpecies.push({ ...skipped, batchId: batch.batchId });
  }

  const setIds = allDrafts.map(d => d.setId);
  const duplicateSetIds = setIds.filter((id, index) => setIds.indexOf(id) !== index);
  const distinctSpecies = new Set(allDrafts.map(d => d.pokemonId));
  const wave3AttemptedSpecies = new Set(batchPlan.batches.flatMap(b => (JSON.parse(fs.readFileSync(path.join(runDir, 'batches', b.batchId, 'candidates.json'), 'utf8')) as { pokemonIds: string[] }).pokemonIds));
  const wave3ProcessedSpecies = new Set(allDrafts.filter(d => d.source !== 'wave2-pilot' && d.source !== 'wave1-sentinel').map(d => d.pokemonId));

  writeAtomic(path.join(runDir, 'consolidated', 'no-legal-candidate-species.json'), { runId, count: allSkippedSpecies.length, species: allSkippedSpecies, terminalStatus: 'processed-no-legal-candidate' });

  const verdictCounts: Record<string, number> = { 'expert-validated': 0, 'expert-review-required': 0, rejected: 0 };
  for (const v of allVerdicts) verdictCounts[v.verdict] = (verdictCounts[v.verdict] ?? 0) + 1;

  writeAtomic(path.join(runDir, 'consolidated', 'all-candidates.json'), { runId, sources: { wave2Pilot: PILOT_RUN_ID, wave3Batches: batchPlan.batches.map(b => b.batchId) }, totalCandidates: allDrafts.length, drafts: allDrafts });
  writeAtomic(path.join(runDir, 'consolidated', 'all-verdicts.json'), { runId, totalVerdicts: allVerdicts.length, verdicts: allVerdicts });
  writeAtomic(path.join(runDir, 'consolidated', 'verdict-distribution.json'), { runId, counts: verdictCounts, total: allVerdicts.length });
  writeAtomic(path.join(runDir, 'consolidated', 'duplicate-audit.json'), { runId, totalCandidates: allDrafts.length, duplicateSetIdCount: duplicateSetIds.length, duplicateSetIds, distinctSpeciesCount: distinctSpecies.size });
  writeAtomic(path.join(runDir, 'consolidated', 'batch-source-counts.json'), { runId, batchSourceCounts });
  writeAtomic(path.join(runDir, 'consolidated', 'sentinel-inclusion-note.json'), {
    runId, includedSpeciesIds: [...sentinelDraftBySetId.values()].map(d => d.pokemonId).filter((id, i, arr) => arr.indexOf(id) === i),
    reasonCode: 'SENTINEL_HISTORICAL_VERDICT_NOT_EXPERT_VALIDATED',
    reason: 'Wave 1 sentinel candidates DO have a real, structured draft payload (moves/item/EVs/provenance) at artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1/drafts.json, confirmed authentic against final-expert-verdicts.json via matching candidateDigest values. They are merged into this consolidation like the Wave 2 pilot candidates. None of the 20 sentinel candidates land in the validated package because their historical verdict is expert-review-required (0 expert-validated), not because of any data-availability gap.',
    sourceDrafts: SENTINEL_DRAFTS_PATH, sourceVerdicts: SENTINEL_VERDICTS_PATH,
  });
  // Peer review round 2 (WAVE3-PR-06): an earlier version of this script wrote a false
  // sentinel-exclusion-note.json (superseded by the honest sentinel-inclusion-note.json above) and
  // left it on disk uncleaned, contradicting the corrected note. Explicitly remove any stale copy
  // so a fresh consolidate run can never leave a false claim sitting next to its correction.
  const staleExclusionNotePath = path.join(runDir, 'consolidated', 'sentinel-exclusion-note.json');
  if (fs.existsSync(staleExclusionNotePath)) fs.unlinkSync(staleExclusionNotePath);

  const eligibleTotal = new Set([...sentinelDraftBySetId.values()].map(d => d.pokemonId)).size + PILOT_POKEMON_IDS.length + wave3AttemptedSpecies.size;
  const valid = duplicateSetIds.length === 0 && allDrafts.length === allVerdicts.length && wave3AttemptedSpecies.size === 173 && wave3ProcessedSpecies.size + allSkippedSpecies.length === 173 && eligibleTotal === 203;

  console.log(JSON.stringify({ valid, totalCandidates: allDrafts.length, distinctSpeciesCount: distinctSpecies.size, wave3ProcessedSpeciesCount: wave3ProcessedSpecies.size, wave3SkippedSpeciesCount: allSkippedSpecies.length, duplicateSetIdCount: duplicateSetIds.length, verdictCounts, eligibleTotalAccountedFor: eligibleTotal, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 16;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
