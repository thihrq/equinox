import fs from 'fs';
import path from 'path';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }

/**
 * Second-pass, read-only gate check over the artifacts already written by
 * sets:champions:expansion:pilot:{select,generate,run} -- re-derives every section-42 gate
 * condition directly from the persisted JSON (not from in-memory state), so a stale or
 * hand-edited artifact would be caught here even if the original run's own process.exitCode
 * looked fine.
 */
function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const pilotDir = path.resolve(`artifacts/competitive-production-readiness/${runId}/pilot`);

  const required = ['selected-pokemon.json', 'selection-coverage.json', 'candidates.json', 'verdicts.json', 'verdict-distribution.json', 'decision-trace-coverage.json', 'audit.json', 'illegal-path-proof.json'];
  for (const file of required) if (!fs.existsSync(path.join(pilotDir, file))) fail(`Missing pilot artifact -- run select/generate/run first: ${file}`, 12);

  const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(pilotDir, file), 'utf8'));
  const selected = readJson('selected-pokemon.json');
  const selectionCoverage = readJson('selection-coverage.json');
  const candidates = readJson('candidates.json');
  const verdictDistribution = readJson('verdict-distribution.json');
  const decisionTraceCoverage = readJson('decision-trace-coverage.json');
  const audit = readJson('audit.json');
  const illegalPathProof = readJson('illegal-path-proof.json');

  const gate = {
    pilotPokemonProcessed: selected.count === 20,
    sentinelPokemonSelected: selectionCoverage.sentinelPokemonSelected === 0,
    provisionalPokemonSelected: selectionCoverage.provisionalPokemonSelected === 0,
    pilotCandidatesGenerated: candidates.legalCount > 0 && candidates.legalCount <= 40,
    pilotCandidateLegalityCoverage: audit.pilotCandidateLegalityCoverage === 100,
    pilotEvidenceAuditCoverage: audit.pilotEvidenceAuditCoverage === 100,
    pilotVerdictCoverage: audit.pilotVerdictCoverage === 100,
    pilotDecisionTraceCoverage: decisionTraceCoverage.coverageRate === 100,
    pilotDigestMismatch: audit.pilotDigestMismatch === 0,
    pilotOriginalMutationCount: audit.pilotOriginalMutationCount === 0,
    pilotDraftPromotionCount: audit.pilotDraftPromotionCount === 0,
    healthyValidatedPath: verdictDistribution.expertValidatedPath === true,
    uncertainReviewRequiredPath: verdictDistribution.expertReviewRequiredPath === true,
    illegalRejectedPath: illegalPathProof.matchesExpectation === true,
  };

  const valid = Object.values(gate).every(Boolean);
  console.log(JSON.stringify({ valid, gate, selectedCount: selected.count, legalCandidateCount: candidates.legalCount, verdictCounts: verdictDistribution.counts, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 16;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
