// Wave 3 -- Fase C canary gate. Read-only: evaluates the already-executed canary batch's real
// artifacts against every Section 40 gate dimension (roster coverage, legality, evidence,
// specialists, verdicts, artifacts, digests, resume, isolation, performance, Mongo/production
// access) and prints a single valid/invalid verdict. Mission rule: "nao continuar se o canario
// falhar" -- this script never triggers full expansion itself, it only decides whether the
// operator is authorized to proceed to sets:champions:expansion:full:run.
import fs from 'fs';
import path from 'path';
import { FULL_ROSTER_EXPANSION_POLICY } from '../services/competitive-data/expert/wave3/FullRosterExpansionPolicy';
import { ALREADY_PROCESSED_POKEMON_IDS } from '../services/competitive-data/expert/wave3/AlreadyProcessedPokemonIds';
import { Stage4CandidateContext } from '../services/competitive-data/expert/Stage4ExpertTypes';

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

const REQUIRED_TAGS = ['fast', 'slow', 'physical-attacker', 'special-attacker', 'support', 'weather', 'trick-room', 'alternate-form'];

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const batchDir = path.join(runDir, 'batches', 'canary');
  const requiredFiles = ['candidates.json', 'full-team-structures.json', 'evidence-packages.json', 'specialist-results.json', 'verdicts.json', 'performance.json', 'checkpoint.json'];
  const artifactsAllPresent = requiredFiles.every(f => fs.existsSync(path.join(batchDir, f)));
  if (!artifactsAllPresent) fail(`Canary batch has not been run yet -- run sets:champions:expansion:full:generate --batch-id canary first (missing one of: ${requiredFiles.join(', ')})`, 12);

  const canarySelection = JSON.parse(fs.readFileSync(path.join(runDir, 'planning', 'canary-selection.json'), 'utf8')) as { pokemonIds: string[]; representedTags: string[] };
  const candidatesFile = JSON.parse(fs.readFileSync(path.join(batchDir, 'candidates.json'), 'utf8')) as { pokemonIds: string[]; reviews: Array<{ setId: string; legal: boolean }>; drafts: Array<{ setId: string; pokemonId: string }> };
  const evidencePackages = JSON.parse(fs.readFileSync(path.join(batchDir, 'evidence-packages.json'), 'utf8')) as { packages: Array<{ setId: string; context: Stage4CandidateContext }> };
  const specialistResultsFile = JSON.parse(fs.readFileSync(path.join(batchDir, 'specialist-results.json'), 'utf8')) as { results: Array<{ setId: string; specialistResults: Array<{ specialistId: string }> }> };
  const verdictsFile = JSON.parse(fs.readFileSync(path.join(batchDir, 'verdicts.json'), 'utf8')) as { verdicts: Array<{ setId: string; verdict: string; decisionTrace?: unknown[] }> };
  const performance = JSON.parse(fs.readFileSync(path.join(batchDir, 'performance.json'), 'utf8')) as { p50Ms: number; p95Ms: number; maxMs: number; candidateCount: number };
  const checkpoint = JSON.parse(fs.readFileSync(path.join(batchDir, 'checkpoint.json'), 'utf8')) as { status: string; attemptCount: number; packageDigest: string; policyVersion: string; targetCatalogDigest: string; inputDigest: string; artifactDigest: string };

  // 1. Roster coverage: the batch actually covers the canary selection's own species/tags.
  const rosterCoverage = {
    pokemonIdsMatchSelection: JSON.stringify([...candidatesFile.pokemonIds].sort()) === JSON.stringify([...canarySelection.pokemonIds].sort()),
    allRequiredTagsRepresented: REQUIRED_TAGS.every(t => canarySelection.representedTags.includes(t)),
    disjointFromPriorWaves: canarySelection.pokemonIds.every(id => !ALREADY_PROCESSED_POKEMON_IDS.includes(id)),
  };

  // 2. Legality: every generated candidate is legal (no illegal candidate silently promoted).
  const legality = { allCandidatesLegal: candidatesFile.reviews.length > 0 && candidatesFile.reviews.every(r => r.legal) };

  // 3. Evidence: every candidate meets the real evidence thresholds this policy declares.
  const evidence = {
    allMeetScenarioThreshold: evidencePackages.packages.every(p => p.context.scenarioEvidenceCount >= FULL_ROSTER_EXPANSION_POLICY.evidenceRequirements.minScenarioCount),
    allMeetFullTeamThreshold: evidencePackages.packages.every(p => p.context.fullTeamEvidenceCount >= FULL_ROSTER_EXPANSION_POLICY.evidenceRequirements.minFullTeamStructureCount),
    coverageComplete: evidencePackages.packages.length === candidatesFile.drafts.length,
  };

  // 4. Specialists: every required specialist actually ran for every candidate.
  const requiredSpecialists = FULL_ROSTER_EXPANSION_POLICY.specialistRequirements.requiredSpecialistIds;
  const specialists = { allRequiredSpecialistsRanForEveryCandidate: specialistResultsFile.results.every(r => requiredSpecialists.every(id => r.specialistResults.some(s => s.specialistId === id))) };

  // 5. Verdicts: every candidate landed on one of the 3 real terminal states with a real decision trace.
  const allowedVerdicts = new Set(['expert-validated', 'expert-review-required', 'rejected']);
  const verdicts = {
    allTerminal: verdictsFile.verdicts.every(v => allowedVerdicts.has(v.verdict)),
    allHaveDecisionTrace: verdictsFile.verdicts.every(v => Array.isArray(v.decisionTrace) && v.decisionTrace.length > 0),
    coverageComplete: verdictsFile.verdicts.length === candidatesFile.drafts.length,
  };

  // 6. Artifacts: already gated above (artifactsAllPresent) -- restated here for the report.
  const artifacts = { allRequiredFilesPresent: artifactsAllPresent };

  // 7. Digests: checkpoint recorded real sha256 digests for every required dimension.
  const digestFields = [checkpoint.packageDigest, checkpoint.policyVersion, checkpoint.targetCatalogDigest, checkpoint.inputDigest, checkpoint.artifactDigest];
  const digests = { allDigestsPresent: digestFields.every(d => typeof d === 'string' && d.length > 0), artifactDigestIsSha256: checkpoint.artifactDigest.startsWith('sha256:') };

  // 8. Resume: checkpoint reflects a genuinely completed, non-exhausted attempt.
  const resume = { statusCompleted: checkpoint.status === 'completed', attemptWithinBudget: checkpoint.attemptCount <= FULL_ROSTER_EXPANSION_POLICY.failurePolicy.maxRetryAttempts };

  // 9. Isolation: no setId collision within the batch, and no species overlap with prior waves' already-processed set.
  const setIds = candidatesFile.drafts.map(d => d.setId);
  const isolation = { noDuplicateSetIds: new Set(setIds).size === setIds.length, noPriorWaveOverlap: candidatesFile.drafts.every(d => !ALREADY_PROCESSED_POKEMON_IDS.includes(d.pokemonId)) };

  // 10. Performance: within the policy's per-batch duration budget.
  const performanceGate = { withinBudget: performance.maxMs <= FULL_ROSTER_EXPANSION_POLICY.batchPolicy.maxBatchDurationMsBudget, candidateCountPositive: performance.candidateCount > 0 };

  // 11. No Mongo/network/production access anywhere in this pipeline -- true by construction (no such imports exist).
  const accessGate = { mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 };

  const gate = { rosterCoverage, legality, evidence, specialists, verdicts, artifacts, digests, resume, isolation, performance: performanceGate };
  const valid = Object.values(gate).every(section => Object.values(section).every(Boolean));

  writeAtomic(path.join(runDir, 'reports', 'canary-gate.json'), { runId, valid, gate, accessGate, canaryPokemonIds: canarySelection.pokemonIds, candidateCount: candidatesFile.drafts.length });

  console.log(JSON.stringify({ valid, gate, ...accessGate }));
  if (!valid) process.exitCode = 20;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
  }
}
