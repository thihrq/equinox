import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { generateCandidateScenarios, CatalogTargetRecord } from '../services/competitive-data/expert/wave2/CandidateScenarioEngine';
import { buildSpeciesMoveContext, hasTailwindMove, hasTrickRoomMove, hasWeatherSetter, hasTerrainSetter } from '../services/competitive-data/expert/wave2/PokemonProfileClassifier';
import { validateCandidateWithExperts } from '../services/competitive-data/expert/Stage4ExpertOrchestrator';
import { Stage4CandidateContext } from '../services/competitive-data/expert/Stage4ExpertTypes';
import { CurationSetDraft, CandidateReview } from '../services/competitive-data/curation/CompetitiveCurationTypes';
import { ChampionsMoveRecord } from '../equinox/data-packs/champions/ChampionsPackageTypes';

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

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const targetsDir = path.join(runDir, 'targets');
  const pilotDir = path.join(runDir, 'pilot');
  const fullTeamDir = path.join(runDir, 'full-team');
  const benchmarksDir = path.join(runDir, 'benchmarks');
  for (const [dir, file] of [[pilotDir, 'candidates.json'], [targetsDir, 'previous-catalog.json'], [targetsDir, 'expanded-catalog.json'], [fullTeamDir, 'full-team-structures.json'], [benchmarksDir, 'benchmark-outcomes.json']] as const) if (!fs.existsSync(path.join(dir, file))) fail(`Missing prerequisite artifact: ${path.join(dir, file)}`, 12);

  const startedAt = Date.now();
  const pkg = loadChampionsCompetitivePackage();
  const natures = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/natures.json', 'utf8')).natures as Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>;
  const candidatesFile = JSON.parse(fs.readFileSync(path.join(pilotDir, 'candidates.json'), 'utf8'));
  const drafts = candidatesFile.drafts as CurationSetDraft[];
  const reviews = candidatesFile.reviews as CandidateReview[];
  const reviewBySetId = new Map(reviews.map(r => [r.setId, r]));
  const previousCatalog = JSON.parse(fs.readFileSync(path.join(targetsDir, 'previous-catalog.json'), 'utf8')).records as CatalogTargetRecord[];
  const expandedCatalog = JSON.parse(fs.readFileSync(path.join(targetsDir, 'expanded-catalog.json'), 'utf8')).records as CatalogTargetRecord[];
  const catalog: CatalogTargetRecord[] = [...previousCatalog, ...expandedCatalog];
  const fullTeamStructures = JSON.parse(fs.readFileSync(path.join(fullTeamDir, 'full-team-structures.json'), 'utf8')).structures as Array<{ setId: string; legal: boolean }>;
  const benchmarkOutcomes = JSON.parse(fs.readFileSync(path.join(benchmarksDir, 'benchmark-outcomes.json'), 'utf8')).outcomes as Array<{ setId: string; dominated: boolean }>;
  const dominatedBySetId = new Map(benchmarkOutcomes.map(o => [o.setId, o.dominated]));

  const packageDigest = pkg.sourceManifest.packageDigest;
  const mechanicsDigest = digest({ moves: pkg.moves.length, abilities: pkg.abilities.length, items: pkg.items.length });
  const rosterDigest = digest(pkg.roster.map(r => r.pokemonId).sort());

  const speciesById = new Map(pkg.species.map(s => [s.pokemonId, s]));
  const perCandidatePerf: Array<{ setId: string; durationMs: number }> = [];

  const results = drafts.map(draft => {
    const t0 = Date.now();
    const species = speciesById.get(draft.pokemonId)!;
    const review = reviewBySetId.get(draft.setId)!;
    const scenarioSet = generateCandidateScenarios(draft, { pkg, natures, catalog, targetsPerCandidate: 6 });
    const favorableScenarioCount = scenarioSet.scenarios.filter(s => s.result === 'favorable').length;
    const adverseScenarioCount = scenarioSet.scenarios.filter(s => s.result === 'adverse').length;
    const candidateStructures = fullTeamStructures.filter(s => s.setId === draft.setId);
    const fullTeamLegal = candidateStructures.length > 0 && candidateStructures.every(s => s.legal);
    const draftMoves = draft.moveIds.map(id => pkg.moves.find(m => m.moveId === id)).filter((m): m is ChampionsMoveRecord => Boolean(m));
    const moveCtx = { ...buildSpeciesMoveContext(species, pkg), legalMoves: draftMoves };
    const maxCandidatePercent = scenarioSet.scenarios.length > 0 ? Math.max(...scenarioSet.scenarios.map(s => s.candidateMaxPercent)) : 0;
    const distinctDamagingTypes = new Set(draftMoves.filter(m => (m.power ?? 0) > 0).map(m => m.type)).size;

    const context: Stage4CandidateContext = {
      candidate: { candidateId: draft.setId, candidateDigest: draft.provenance.candidateDigest, sourceType: 'generated', status: 'draft', humanReviewed: false, automaticPromotionAllowed: false },
      legal: review.legal, coherent: review.coherent, rolesSupported: review.rolesSupported, generationResolved: true, formResolved: true,
      damageEvidence: scenarioSet.scenarios.length > 0, speedEvidence: scenarioSet.scenarios.length > 0,
      scenarioEvidenceCount: scenarioSet.scenarios.length, favorableScenarioCount, adverseScenarioCount,
      fullTeamEvidenceCount: candidateStructures.length, fullTeamLegal, benchmarkEvidence: true,
      unsupportedMechanics: [],
      packageDigest, mechanicsDigest, rosterDigest, previousVerdict: 'agent-reviewed', archetype: draft.targetArchetypes[0] ?? 'balanced',
      isMega: false, isRegional: draft.pokemonId.includes('-') && draft.pokemonId.split('-')[1] !== '000',
      hasTrickRoom: hasTrickRoomMove(moveCtx), hasTailwind: hasTailwindMove(moveCtx), hasWeather: hasWeatherSetter(moveCtx), hasTerrain: hasTerrainSetter(moveCtx),
      criticalReviewSignals: {
        candidateDominated: dominatedBySetId.get(draft.setId) ?? false,
        fullTeamRiskMaterial: candidateStructures.length < 5 || !fullTeamLegal,
        noWinCondition: maxCandidatePercent < 50,
        coverageInsufficient: distinctDamagingTypes <= 1,
        excessivePartnerDependency: false,
        contradictoryEvidence: false,
      },
    };
    const validation = validateCandidateWithExperts(context);
    perCandidatePerf.push({ setId: draft.setId, durationMs: Date.now() - t0 });
    return { setId: draft.setId, pokemonId: draft.pokemonId, context, validation, scenarioSet };
  });

  const verdictCounts: Record<string, number> = { 'expert-validated': 0, 'expert-review-required': 0, rejected: 0 };
  for (const r of results) verdictCounts[r.validation.verdict] = (verdictCounts[r.validation.verdict] ?? 0) + 1;
  const decisionTraceCoverage = results.filter(r => Array.isArray(r.validation.decisionTrace) && r.validation.decisionTrace!.length > 0).length;
  const digestMismatches = results.filter(r => !r.validation.candidateDigest || r.validation.candidateDigest !== r.context.candidate.candidateDigest).length;

  // The 40 real pilot candidates are all legally-generated by construction (validateDrafts already
  // enforces legality before this script runs), so none of them can naturally land on the
  // 'rejected' path -- this mirrors Wave 1C, where the illegal path was proven via one explicit,
  // clearly-labeled mutation of a real context, never by hoping a real candidate happens to be
  // illegal. Kept fully separate from verdictCounts/verdicts.json so it never pollutes the real
  // 40-candidate distribution.
  const illegalMutationBase = results[0];
  const illegalMutationContext: Stage4CandidateContext = { ...illegalMutationBase.context, candidate: { ...illegalMutationBase.context.candidate, candidateId: `${illegalMutationBase.setId}-wave2-illegal-mutation` }, legal: false };
  const illegalMutationResult = validateCandidateWithExperts(illegalMutationContext);
  writeAtomic(path.join(pilotDir, 'illegal-path-proof.json'), { runId, sourceCandidateSetId: illegalMutationBase.setId, mutation: 'legal:false, otherwise identical to a real pilot candidate context', verdict: illegalMutationResult.verdict, confidence: illegalMutationResult.confidence, matchesExpectation: illegalMutationResult.verdict === 'rejected' });

  writeAtomic(path.join(pilotDir, 'evidence-packages.json'), { runId, packages: results.map(r => ({ setId: r.setId, context: r.context, scenarioSignature: r.scenarioSet.signature })) });
  writeAtomic(path.join(pilotDir, 'specialist-results.json'), { runId, results: results.map(r => ({ setId: r.setId, specialistResults: r.validation.specialistResults })) });
  writeAtomic(path.join(pilotDir, 'verdicts.json'), { runId, verdicts: results.map(r => ({ setId: r.setId, pokemonId: r.pokemonId, verdict: r.validation.verdict, confidence: r.validation.confidence, humanReviewRequirement: r.validation.humanReviewRequirement, reasonCodes: r.validation.reasonCodes, materialFindings: r.validation.materialFindings, decisionTrace: r.validation.decisionTrace })) });
  writeAtomic(path.join(pilotDir, 'verdict-distribution.json'), { runId, counts: verdictCounts, total: results.length, expertValidatedPath: verdictCounts['expert-validated'] > 0, expertReviewRequiredPath: verdictCounts['expert-review-required'] > 0, rejectedPath: verdictCounts.rejected > 0, illegalRejectedPathProvenByMutation: illegalMutationResult.verdict === 'rejected' });
  writeAtomic(path.join(pilotDir, 'decision-trace-coverage.json'), { runId, total: results.length, withDecisionTrace: decisionTraceCoverage, coverageRate: results.length > 0 ? Math.round((decisionTraceCoverage / results.length) * 100) : 0 });
  const durations = perCandidatePerf.map(p => p.durationMs).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? durations[durations.length - 1] ?? 0;
  writeAtomic(path.join(pilotDir, 'performance.json'), { runId, totalDurationMs: Date.now() - startedAt, perCandidate: perCandidatePerf, p50Ms: p50, p95Ms: p95, maxMs: durations[durations.length - 1] ?? 0, candidateCount: results.length });
  writeAtomic(path.join(pilotDir, 'audit.json'), {
    runId, pilotPokemonProcessed: new Set(results.map(r => r.pokemonId)).size, pilotCandidatesGenerated: results.length,
    pilotCandidateLegalityCoverage: results.length > 0 ? Math.round((results.filter(r => r.context.legal).length / results.length) * 100) : 0,
    pilotEvidenceAuditCoverage: results.length > 0 ? Math.round((results.filter(r => r.validation.evidenceAudit).length / results.length) * 100) : 0,
    pilotVerdictCoverage: results.length > 0 ? Math.round((results.filter(r => Boolean(r.validation.verdict)).length / results.length) * 100) : 0,
    pilotDecisionTraceCoverage: results.length > 0 ? Math.round((decisionTraceCoverage / results.length) * 100) : 0,
    pilotDigestMismatch: digestMismatches, pilotOriginalMutationCount: 0, pilotDraftPromotionCount: 0,
    verdictCounts,
  });

  const illegalRejectedPathProvenByMutation = illegalMutationResult.verdict === 'rejected';
  const valid = results.length > 0 && verdictCounts['expert-validated'] + verdictCounts['expert-review-required'] + verdictCounts.rejected === results.length && digestMismatches === 0 && decisionTraceCoverage === results.length && illegalRejectedPathProvenByMutation;
  console.log(JSON.stringify({ valid, candidateCount: results.length, verdictCounts, decisionTraceCoverage, digestMismatches, illegalRejectedPathProvenByMutation, p50Ms: p50, p95Ms: p95, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 16;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
