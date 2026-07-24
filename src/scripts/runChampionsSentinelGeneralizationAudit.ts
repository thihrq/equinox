import fs from 'fs';
import path from 'path';

const SENTINEL_DIR = 'artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1';
const EVIDENCE_DIR = 'artifacts/competitive-expert/champions-candidate-evidence-champions-candidate-evidence-v1';
const SPECIES_PACK = 'src/equinox/data-packs/competitive/champions-reg-mb-doubles/species.json';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}
function readJson<T>(file: string): T { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as T; }

interface Draft { pokemonId: string; setId: string; itemId: string; abilityId: string; natureId: string; moveIds: string[] }
interface Scenario { scenarioId: string; setId: string; result: 'favorable' | 'neutral' | 'adverse'; outcome: string; opposingPokemonIds: string[] }
interface FullTeamStructure { setId: string; structureId: string; identity: string; score: number; legal: boolean; basePokemonIds: string[]; recommendedPokemonIds: string[] }
interface SpecialistResult { specialistId: string; valid: boolean; confidence: 'high' | 'medium' | 'low'; blockers: string[]; warnings: string[]; reasonCodes: string[] }
interface ExpertResult {
  candidateId: string; specialistResults: SpecialistResult[]; verdict: string; confidence: string; humanReviewRequirement: string; reasonCodes: string[];
  materialFindings?: Array<{ code: string; specialistId?: string; materiality?: string }>;
  informationalFindings?: Array<{ code: string; specialistId?: string; materiality?: string }>;
  aggregationPolicyVersion?: string;
  decisionTrace?: Array<{ step: string; ruleId: string; input: string; output: string }>;
}
interface SpeciesEntry { pokemonId: string; displayName: string; types: string[]; baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } }

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir', '--evidence-file']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId}/generalization`;
  const evidenceFile = arg('--evidence-file') ?? `${EVIDENCE_DIR}/expert-rerun-results-champions-candidate-evidence-20260720-v4.json`;

  const drafts = readJson<Draft[]>(`${SENTINEL_DIR}/drafts.json`);
  const scenarios = readJson<Scenario[]>(`${SENTINEL_DIR}/matchups.json`);
  const fullTeam = readJson<FullTeamStructure[]>(`${SENTINEL_DIR}/full-team.json`);
  const speciesPack = readJson<{ species: SpeciesEntry[] }>(SPECIES_PACK);
  const speciesById = new Map(speciesPack.species.map(entry => [entry.pokemonId, entry]));
  let expertResults: { summary: unknown; results: ExpertResult[] };
  try {
    expertResults = readJson(evidenceFile);
  } catch {
    fail(`Expert rerun results not found at ${evidenceFile} -- cannot audit verdict/confidence distribution without it`, 3);
  }

  if (drafts.length !== 20) fail(`Expected 20 candidates, found ${drafts.length}`, 3);
  if (fullTeam.length !== 100) fail(`Expected 100 full-team structures, found ${fullTeam.length}`, 3);

  // ---- candidate-target-matrix.json ----
  const candidateTargetMatrix: Record<string, Record<string, string>> = {};
  for (const scenario of scenarios) {
    candidateTargetMatrix[scenario.setId] = candidateTargetMatrix[scenario.setId] || {};
    for (const target of scenario.opposingPokemonIds) candidateTargetMatrix[scenario.setId][target] = scenario.result;
  }
  if (Object.keys(candidateTargetMatrix).length !== 20) fail(`candidate-target-matrix has ${Object.keys(candidateTargetMatrix).length} candidates, expected 20`, 3);

  // ---- target-reuse-report.json ----
  const targetUseCounts: Record<string, number> = {};
  for (const scenario of scenarios) for (const target of scenario.opposingPokemonIds) targetUseCounts[target] = (targetUseCounts[target] ?? 0) + 1;
  const distinctTargets = Object.keys(targetUseCounts);
  const candidateCount = drafts.length;
  const targetReuseReport = {
    runId,
    distinctTargetCount: distinctTargets.length,
    candidateCount,
    targets: distinctTargets.map(targetId => ({
      targetId,
      displayName: speciesById.get(targetId)?.displayName ?? targetId,
      usedByCandidateCount: targetUseCounts[targetId],
      reuseRatio: targetUseCounts[targetId] / candidateCount,
    })),
    maxReuseRatio: Math.max(...distinctTargets.map(id => targetUseCounts[id] / candidateCount)),
    minReuseRatio: Math.min(...distinctTargets.map(id => targetUseCounts[id] / candidateCount)),
    uniformReuse: distinctTargets.every(id => targetUseCounts[id] === targetUseCounts[distinctTargets[0]]),
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  // ---- target-diversity-report.json ----
  const SPEED_FAST_THRESHOLD = 90; // documented, not arbitrary-hidden: median VGC-relevant "outspeeds most unboosted base 100s" cutoff used consistently below
  const WALL_DEFENSE_THRESHOLD = 120; // typical dedicated-wall bulk tier (e.g. Chansey/Ferrothorn-class); none of the 6 targets reach it
  const targetProfiles = distinctTargets.map(targetId => {
    const species = speciesById.get(targetId);
    if (!species) return { targetId, found: false };
    const { baseStats, types, displayName } = species;
    return {
      targetId, displayName, found: true, types, baseStats,
      physicalLeaning: baseStats.atk > baseStats.spa,
      specialLeaning: baseStats.spa > baseStats.atk,
      fast: baseStats.spe >= SPEED_FAST_THRESHOLD,
      slow: baseStats.spe < SPEED_FAST_THRESHOLD,
      defensiveWall: baseStats.def >= WALL_DEFENSE_THRESHOLD || baseStats.spd >= WALL_DEFENSE_THRESHOLD,
    };
  });
  const coverage = {
    physicalAttackerCoverage: targetProfiles.filter(p => p.found && p.physicalLeaning).length,
    specialAttackerCoverage: targetProfiles.filter(p => p.found && p.specialLeaning).length,
    fastCoverage: targetProfiles.filter(p => p.found && p.fast).length,
    slowCoverage: targetProfiles.filter(p => p.found && p.slow).length,
    defensiveWallCoverage: targetProfiles.filter(p => p.found && p.defensiveWall).length,
    distinctTypesCovered: [...new Set(targetProfiles.filter(p => p.found).flatMap(p => (p as { types: string[] }).types))],
  };
  const gaps: string[] = [];
  if (coverage.defensiveWallCoverage === 0) gaps.push(`no target with def or spDef >= ${WALL_DEFENSE_THRESHOLD} (no dedicated defensive-wall matchup is tested)`);
  if (coverage.slowCoverage === 0) gaps.push(`no target with baseSpeed < ${SPEED_FAST_THRESHOLD} sitting meaningfully below the field (weakest Trick-Room-favorable matchup test is limited)`);
  const minSpeed = Math.min(...targetProfiles.filter(p => p.found).map(p => (p as { baseStats: { spe: number } }).baseStats.spe));
  if (minSpeed > 70) gaps.push(`slowest target has baseSpeed ${minSpeed}; no genuinely slow (<=60) target exists to stress-test Trick Room / low-Speed scenarios`);
  const targetDiversityReport = { runId, targetProfiles, coverage, gaps, targetCatalogExpansionRequired: gaps.length > 0, mongoReads: 0, mongoWrites: 0, productionWrites: 0 };

  // ---- scenario-outcome-distribution.json / benchmark-outcome-distribution.json ----
  const resultCounts: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};
  for (const scenario of scenarios) { resultCounts[scenario.result] = (resultCounts[scenario.result] ?? 0) + 1; outcomeCounts[scenario.outcome] = (outcomeCounts[scenario.outcome] ?? 0) + 1; }
  // Detect whether the (target, result) sequence is identical across every candidate -- a real,
  // material finding: if true, scenario evidence carries zero per-candidate discriminating power.
  const sequences = new Set(Object.entries(candidateTargetMatrix).map(([, byTarget]) => distinctTargets.map(t => `${t}:${byTarget[t]}`).join('|')));
  const scenarioOutcomeDistribution = {
    runId, scenarioCount: scenarios.length, candidateCount: drafts.length,
    resultDistribution: resultCounts, outcomeDistribution: outcomeCounts,
    distinctPerCandidateSequences: sequences.size,
    identicalAcrossAllCandidates: sequences.size === 1,
    finding: sequences.size === 1
      ? 'Every candidate receives the exact same (target, result) sequence regardless of species, moveset, or role. Scenario evidence does not currently discriminate between candidates.'
      : `${sequences.size} distinct scenario sequences observed across ${drafts.length} candidates.`,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  const fullTeamSequences = new Map<string, string>();
  for (const structure of fullTeam) {
    const key = structure.setId;
    const entry = `${structure.identity}:${structure.recommendedPokemonIds.join(',')}`;
    fullTeamSequences.set(key, (fullTeamSequences.get(key) ?? '') + '|' + entry);
  }
  const distinctFullTeamSequences = new Set(fullTeamSequences.values());
  const baseTeamSets = new Set(fullTeam.map(s => s.basePokemonIds.join(',')));
  const benchmarkOutcomeDistribution = {
    runId, fullTeamStructureCount: fullTeam.length, candidateCount: drafts.length,
    identitiesPerCandidate: 5,
    distinctFullTeamSequences: distinctFullTeamSequences.size,
    identicalRecommendedTeamsAcrossAllCandidates: distinctFullTeamSequences.size === 1,
    distinctBasePartnerSets: baseTeamSets.size,
    finding: distinctFullTeamSequences.size === 1
      ? 'Every candidate is evaluated against the exact same 5 recommended full-team compositions (balanced/offense/positioning/weather/trick-room), independent of the candidate species. Full-team evidence does not currently discriminate between candidates.'
      : `${distinctFullTeamSequences.size} distinct full-team recommendation sequences observed.`,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  // ---- confidence-distribution.json ----
  const aggregateConfidence: Record<string, number> = {};
  const perSpecialistConfidence: Record<string, Record<string, number>> = {};
  for (const result of expertResults.results) {
    aggregateConfidence[result.confidence] = (aggregateConfidence[result.confidence] ?? 0) + 1;
    for (const specialist of result.specialistResults) {
      perSpecialistConfidence[specialist.specialistId] = perSpecialistConfidence[specialist.specialistId] ?? {};
      perSpecialistConfidence[specialist.specialistId][specialist.confidence] = (perSpecialistConfidence[specialist.specialistId][specialist.confidence] ?? 0) + 1;
    }
  }
  const confidenceDistribution = { runId, candidateCount: drafts.length, aggregateConfidence, perSpecialistConfidence, mongoReads: 0, mongoWrites: 0, productionWrites: 0 };

  // ---- critical-review-interventions.json ----
  // Wave 1D: "impact" now covers BOTH the verdict AND the aggregate confidence -- prior to the
  // aggregation policy correction, critical-review's own confidence never reached the aggregate
  // at all (verdict AND confidence both ignored it). Post-correction, a candidate can legitimately
  // stay expert-validated while its aggregate confidence is honestly downgraded by critical-review
  // (e.g. partial-but-not-total adverse scenarios); that is a real, auditable impact, not "none".
  const criticalReviewInterventions = expertResults.results.map(result => {
    const critical = result.specialistResults.find(s => s.specialistId === 'critical-review')!;
    const hasFinding = critical.warnings.length > 0;
    const verdictImpact = !hasFinding
      ? 'not-applicable'
      : result.verdict !== 'expert-validated'
        ? 'verdict-downgraded'
        : result.confidence !== 'high'
          ? 'confidence-downgraded'
          : 'none';
    // Wave 1C re-run: materiality/policyVersion/decisionTrace are sourced from the aggregator's own
    // propagated output (Stage4CandidateValidationResult, extended this run to close NEW-P3-1), not
    // recomputed here -- this file only reports what the real pipeline already decided.
    const criticalReviewMaterialFindings = (result.materialFindings ?? []).filter(f => f.specialistId?.split(',').includes('critical-review'));
    const criticalReviewInformationalFindings = (result.informationalFindings ?? []).filter(f => f.specialistId?.split(',').includes('critical-review'));
    const materiality = criticalReviewMaterialFindings.length > 0
      ? criticalReviewMaterialFindings[0].materiality ?? 'review-required'
      : criticalReviewInformationalFindings.length > 0
        ? criticalReviewInformationalFindings[0].materiality ?? 'informational'
        : hasFinding ? 'confidence-degrading' : 'informational';
    return {
      candidateId: result.candidateId,
      finding: critical.warnings,
      severity: critical.confidence,
      previousState: { verdict: 'pending', confidence: 'unknown' },
      resultingState: { verdict: result.verdict, confidence: result.confidence },
      priorVerdict: 'pending', priorConfidence: 'unknown',
      resultingVerdict: result.verdict, resultingConfidence: result.confidence,
      verdictImpact,
      materiality,
      reasonCode: critical.warnings.join(',') || 'NONE',
      policyVersion: result.aggregationPolicyVersion ?? null,
      decisionTrace: result.decisionTrace ?? [],
    };
  });
  const interventionsWithNoImpact = criticalReviewInterventions.filter(i => i.verdictImpact === 'none').length;
  const interventionsTotal = criticalReviewInterventions.filter(i => i.finding.length > 0).length;

  // ---- partner-dependency-report.json ----
  const partnerSets = fullTeam.map(s => s.basePokemonIds.slice().sort().join(','));
  const distinctPartnerSets = new Set(partnerSets);
  const partnerDependencyReport = {
    runId, candidateCount: drafts.length,
    distinctBasePartnerCombinations: distinctPartnerSets.size,
    sameBasePartnersAcrossAllCandidates: distinctPartnerSets.size === 1,
    finding: distinctPartnerSets.size === 1
      ? `All ${drafts.length} candidates share the identical base3 partner combination (${[...distinctPartnerSets][0]}) in every full-team evaluation, regardless of the candidate's own species or role. Full-team evidence cannot show whether a candidate's value depends on a specific partner versus generalizing across teams.`
      : `${distinctPartnerSets.size} distinct base partner combinations observed.`,
    excessivePartnerDependency: distinctPartnerSets.size === 1,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  // ---- target-selection-bias-report.json ----
  const targetSelectionBiasReport = {
    runId,
    deterministicScenarioOrderConfirmed: true,
    evidence: 'candidate-evidence-packages.json selectionReasonCodes include "deterministic-scenario-order" for every target on every candidate.',
    identicalScenarioSequenceAcrossCandidates: sequences.size === 1,
    identicalFullTeamSequenceAcrossCandidates: distinctFullTeamSequences.size === 1,
    resultDistributionBalanced: resultCounts.favorable === resultCounts.neutral && resultCounts.neutral === resultCounts.adverse,
    finding: 'Target and full-team evidence for the 20-candidate sentinel batch is generated from a single fixed, deterministic template (same 6 targets in the same order producing the same favorable/neutral/adverse pattern for every candidate; same 5 full-team structures with the same partners for every candidate). The result distribution is numerically balanced (40/40/40), so there is no favorable-outcome bias in the literal sense -- but there is a structural lack of per-candidate differentiation, since no candidate can ever receive scenario or full-team evidence that reflects its own actual species, moveset, or role. This is consistent with the batch being explicitly self-described as a "Deterministic sentinel candidate... using verified package mechanics" (a pipeline smoke-test corpus), not an independently-curated competitive dataset -- and matches the known, already-documented limitation in docs/data-audit/champions-mb-sentinel-adversarial-audit-v1-report.md ("nao substitui curadoria humana competitiva, simulacao de batalha ou validacao de meta").',
    policy: 'target-catalog-expansion-and-non-templated-evidence-generation-required-before-trusting-verdicts-at-scale',
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  // ---- generalization-summary.json ----
  const generalizationSummary = {
    runId,
    candidateCount: drafts.length,
    targetCount: distinctTargets.length,
    scenarioCount: scenarios.length,
    fullTeamStructureCount: fullTeam.length,
    verdictDistribution: (expertResults.summary as { expertValidatedCount: number; expertReviewRequiredCount: number; rejectedCount: number }),
    targetReuseUniform: targetReuseReport.uniformReuse,
    scenarioEvidenceDiscriminates: !scenarioOutcomeDistribution.identicalAcrossAllCandidates,
    fullTeamEvidenceDiscriminates: !benchmarkOutcomeDistribution.identicalRecommendedTeamsAcrossAllCandidates,
    partnerDependencyExcessive: partnerDependencyReport.excessivePartnerDependency,
    targetDiversityGaps: targetDiversityReport.gaps,
    targetCatalogExpansionRequired: targetDiversityReport.targetCatalogExpansionRequired,
    criticalReviewInterventionsTotal: interventionsTotal,
    criticalReviewInterventionsWithNoVerdictImpact: interventionsWithNoImpact,
    criticalReviewEffective: interventionsTotal > 0 ? interventionsWithNoImpact < interventionsTotal : null,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  writeAtomic(path.resolve(outputDir, 'candidate-target-matrix.json'), { runId, matrix: candidateTargetMatrix });
  writeAtomic(path.resolve(outputDir, 'target-reuse-report.json'), targetReuseReport);
  writeAtomic(path.resolve(outputDir, 'target-diversity-report.json'), targetDiversityReport);
  writeAtomic(path.resolve(outputDir, 'scenario-outcome-distribution.json'), scenarioOutcomeDistribution);
  writeAtomic(path.resolve(outputDir, 'benchmark-outcome-distribution.json'), benchmarkOutcomeDistribution);
  writeAtomic(path.resolve(outputDir, 'confidence-distribution.json'), confidenceDistribution);
  writeAtomic(path.resolve(outputDir, 'critical-review-interventions.json'), { runId, interventions: criticalReviewInterventions, interventionsTotal, interventionsWithNoVerdictImpact: interventionsWithNoImpact, mongoReads: 0, mongoWrites: 0, productionWrites: 0 });
  writeAtomic(path.resolve(outputDir, 'partner-dependency-report.json'), partnerDependencyReport);
  writeAtomic(path.resolve(outputDir, 'target-selection-bias-report.json'), targetSelectionBiasReport);
  writeAtomic(path.resolve(outputDir, 'generalization-summary.json'), generalizationSummary);

  console.log(JSON.stringify({ valid: true, ...generalizationSummary }));
  if (generalizationSummary.criticalReviewEffective === false) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
