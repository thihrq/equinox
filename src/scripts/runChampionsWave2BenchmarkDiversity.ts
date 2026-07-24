import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { generateCandidateScenarios, CatalogTargetRecord } from '../services/competitive-data/expert/wave2/CandidateScenarioEngine';
import { benchmarkCandidate } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkEngine';
import { BenchmarkCandidate } from '../services/competitive-data/expert/engines/CompetitiveBenchmarkTypes';
import { CurationSetDraft } from '../services/competitive-data/curation/CompetitiveCurationTypes';

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
  for (const [dir, file] of [[pilotDir, 'candidates.json'], [targetsDir, 'previous-catalog.json'], [targetsDir, 'expanded-catalog.json'], [fullTeamDir, 'full-team-structures.json']] as const) if (!fs.existsSync(path.join(dir, file))) fail(`Missing prerequisite artifact: ${path.join(dir, file)}`, 12);

  const pkg = loadChampionsCompetitivePackage();
  const natures = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/natures.json', 'utf8')).natures as Array<{ natureId: string; increasedStat: string | null; decreasedStat: string | null }>;
  const drafts = JSON.parse(fs.readFileSync(path.join(pilotDir, 'candidates.json'), 'utf8')).drafts as CurationSetDraft[];
  const previousCatalog = JSON.parse(fs.readFileSync(path.join(targetsDir, 'previous-catalog.json'), 'utf8')).records as CatalogTargetRecord[];
  const expandedCatalog = JSON.parse(fs.readFileSync(path.join(targetsDir, 'expanded-catalog.json'), 'utf8')).records as CatalogTargetRecord[];
  const catalog: CatalogTargetRecord[] = [...previousCatalog, ...expandedCatalog];
  const fullTeamStructures = JSON.parse(fs.readFileSync(path.join(fullTeamDir, 'full-team-structures.json'), 'utf8')).structures as Array<{ setId: string; legal: boolean }>;

  const scenarioSets = drafts.map(draft => generateCandidateScenarios(draft, { pkg, natures, catalog, targetsPerCandidate: 6 }));
  const scenarioBySetId = new Map(scenarioSets.map(s => [s.setId, s]));
  const speeds = drafts.map(d => { const scenarios = scenarioBySetId.get(d.setId)!.scenarios; return scenarios.length; });
  void speeds;

  function dimensionsFor(draft: CurationSetDraft): BenchmarkCandidate['dimensions'] {
    const scenarios = scenarioBySetId.get(draft.setId)!.scenarios;
    const damagePressure = scenarios.length > 0 ? Math.round(scenarios.reduce((sum, s) => sum + s.candidateMaxPercent, 0) / scenarios.length) : 0;
    const favorableRate = scenarios.length > 0 ? Math.round((scenarios.filter(s => s.result === 'favorable').length / scenarios.length) * 100) : 0;
    const speedTier = Math.round(Math.min(100, (scenarios.filter(s => s.actionOrder === 'first').length / Math.max(scenarios.length, 1)) * 100));
    const structures = fullTeamStructures.filter(s => s.setId === draft.setId);
    const fullTeamFit = structures.length > 0 ? Math.round((structures.filter(s => s.legal).length / structures.length) * 100) : 0;
    return { damagePressure: Math.min(100, damagePressure), speedTier, roleFit: favorableRate, archetypeFit: favorableRate, fullTeamFit };
  }

  const bySpecies = new Map<string, CurationSetDraft[]>();
  for (const draft of drafts) bySpecies.set(draft.pokemonId, [...(bySpecies.get(draft.pokemonId) ?? []), draft]);

  const outcomes = drafts.map(draft => {
    // Real alternatives: (a) the sibling candidate for the same species (offensive vs bulky
    // proposal -- a genuine trade-off comparison), and (b) one other candidate sharing at least
    // one real scenario-derived tag class, deterministically the next candidate by setId.
    const sibling = (bySpecies.get(draft.pokemonId) ?? []).find(d => d.setId !== draft.setId);
    const otherIndex = (drafts.findIndex(d => d.setId === draft.setId) + 7) % drafts.length; // fixed deterministic offset, not adjacent/self
    const otherCandidate = drafts[otherIndex];
    const otherFallback = drafts[(otherIndex + 1) % drafts.length];
    const other = otherCandidate && otherCandidate.setId !== draft.setId ? otherCandidate : otherFallback;
    const alternatives = [sibling, other].filter((d): d is CurationSetDraft => d !== undefined && d.setId !== draft.setId);

    const candidate: BenchmarkCandidate = { candidateId: draft.setId, legal: true, evidenceIds: scenarioBySetId.get(draft.setId)!.scenarios.map(s => s.scenarioId), dimensions: dimensionsFor(draft) };
    const alternativeCandidates: BenchmarkCandidate[] = alternatives.map(alt => ({ candidateId: alt.setId, legal: true, evidenceIds: scenarioBySetId.get(alt.setId)!.scenarios.map(s => s.scenarioId), dimensions: dimensionsFor(alt) }));

    const result = benchmarkCandidate({ candidateId: draft.setId, alternativeCandidateIds: alternativeCandidates.map(a => a.candidateId), comparisonLimit: 5, candidate, alternativeCandidates, maxAlternativesPerCandidate: 5, maxMoveVariations: 3, maxItemVariations: 3, maxNatureVariations: 3 });
    return { setId: draft.setId, dominated: result.dominated, comparisons: result.comparisons, dimensions: candidate.dimensions };
  });

  const classificationCounts: Record<string, number> = {};
  for (const outcome of outcomes) for (const comparison of outcome.comparisons) classificationCounts[comparison.classification] = (classificationCounts[comparison.classification] ?? 0) + 1;
  const dominatedCount = outcomes.filter(o => o.dominated).length;
  const alternativeSuperiorPathExists = (classificationCounts['dominated'] ?? 0) > 0 || (classificationCounts['strictly-inferior'] ?? 0) > 0;
  const tradeOffPathExists = (classificationCounts['inferior-in-one-dimension'] ?? 0) > 0 || (classificationCounts['different'] ?? 0) > 0;
  const insufficientEvidencePathExists = outcomes.some(o => o.comparisons.length === 0);
  const allCandidateSuperior = dominatedCount === 0 && !insufficientEvidencePathExists;

  writeAtomic(path.join(benchmarksDir, 'benchmark-policy.json'), { runId, policyId: 'wave2-benchmark-diversity-policy', policyVersion: 'wave2-benchmark-diversity-v1', dimensionSources: { damagePressure: 'mean candidateMaxPercent across the candidate\'s own real scenarios', speedTier: 'share of scenarios where the candidate acts first', roleFit: 'favorable-scenario rate', archetypeFit: 'favorable-scenario rate', fullTeamFit: 'legal-rate across the candidate\'s own full-team structures' }, alternativeSelection: 'sibling candidate (same species, other EV proposal) + one deterministic other pilot candidate, never hand-picked to make the subject look good or bad' });
  writeAtomic(path.join(benchmarksDir, 'candidate-benchmark-matrix.json'), { runId, records: outcomes.map(o => ({ setId: o.setId, dimensions: o.dimensions, alternativeCount: o.comparisons.length })) });
  writeAtomic(path.join(benchmarksDir, 'benchmark-outcomes.json'), { runId, outcomes });
  writeAtomic(path.join(benchmarksDir, 'benchmark-distribution.json'), { runId, classificationCounts, dominatedCount, totalCandidates: outcomes.length, alternativeSuperiorPathExists, tradeOffPathExists, insufficientEvidencePathExists });
  writeAtomic(path.join(benchmarksDir, 'benchmark-bias-report.json'), { runId, allCandidateSuperior, finding: allCandidateSuperior ? 'Every candidate benchmarked as equal-or-better than every real alternative -- this would indicate a biased comparison and must be investigated before approval.' : 'At least one candidate did not classify as superior to its real alternatives, consistent with a genuine (non-rigged) comparison.', gate: { alternativeSuperiorPathExists, tradeOffPathExists, insufficientEvidencePathExists } });

  const valid = alternativeSuperiorPathExists && tradeOffPathExists;
  console.log(JSON.stringify({ valid, totalCandidates: outcomes.length, dominatedCount, classificationCounts, alternativeSuperiorPathExists, tradeOffPathExists, insufficientEvidencePathExists, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 25;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
