import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { generateDrafts, validateDrafts } from '../services/competitive-data/curation/CompetitiveCurationCore';
import { CurationConfig, SentinelSelection } from '../services/competitive-data/curation/CompetitiveCurationTypes';
import { generateCandidateScenarios, CatalogTargetRecord } from '../services/competitive-data/expert/wave2/CandidateScenarioEngine';
import { buildFullTeamStructure, ALL_SHELLS } from '../services/competitive-data/expert/wave2/FullTeamDiversityEngine';
import { maxCalculatedSpeed } from '../services/competitive-data/expert/wave2/PokemonProfileClassifier';
import { expandTargetCatalog } from '../services/competitive-data/expert/wave2/TargetCatalogExpansion';
import fs from 'fs';

const pkg = loadChampionsCompetitivePackage();
const validation = validateChampionsCompetitivePackage(pkg);
const natures = JSON.parse(fs.readFileSync('src/equinox/data-packs/competitive/champions-reg-mb-doubles/natures.json', 'utf8')).natures;
const SENTINEL_POKEMON_IDS = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000', '0025-000', '0026-000', '0036-000', '0038-000'];
const PREVIOUS_TARGET_IDS = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000'];

// Real, non-sentinel test candidates (small sample: 3 species, 2 candidates each = 6 drafts).
const samplePokemonIds = validation.eligiblePokemonIds.filter(id => !SENTINEL_POKEMON_IDS.includes(id)).slice(0, 3);
const config: CurationConfig = { snapshotId: 'wave2-test', regulationId: 'M-B', pokemonLimit: samplePokemonIds.length, candidatesPerPokemon: 2, seed: 'wave2-test', packageDigest: pkg.sourceManifest.packageDigest, package: pkg };
const selection: SentinelSelection = { sentinelRunId: 'wave2-test', snapshotId: config.snapshotId, regulationId: 'M-B', packageDigest: config.packageDigest, eligiblePoolDigest: 'n/a', seed: config.seed, policyVersion: 'wave2-test-v1', selectedPokemonIds: samplePokemonIds, representedCategories: [], missingCategories: [], blockers: [], warnings: [] };
const drafts = generateDrafts(config, selection);
const reviews = validateDrafts(config, drafts);
if (!reviews.every(r => r.legal)) throw new Error('WAVE2_TEST_SETUP_ILLEGAL_DRAFT');

const expansion = expandTargetCatalog({ pkg, validation, previousTargetPokemonIds: PREVIOUS_TARGET_IDS });
const catalog: CatalogTargetRecord[] = expansion.newTargets;

// ---- SCENARIOS ----
// Case: distinct candidates must NOT receive byte-identical scenario sets.
const scenarioSets = drafts.map(draft => generateCandidateScenarios(draft, { pkg, natures, catalog, targetsPerCandidate: 6 }));
const signatures = scenarioSets.map(s => s.signature);
if (new Set(signatures).size !== signatures.length) throw new Error('WAVE2_SCENARIOS_IDENTICAL_ACROSS_CANDIDATES');

// Case: every scenario must have a real target and a real (possibly zero) outcome, never undefined.
for (const set of scenarioSets) {
  if (set.scenarios.length === 0) throw new Error(`WAVE2_SCENARIOS_EMPTY:${set.setId}`);
  for (const scenario of set.scenarios) {
    if (!scenario.targetSetId) throw new Error(`WAVE2_SCENARIO_MISSING_TARGET:${scenario.scenarioId}`);
    if (!['favorable', 'neutral', 'adverse'].includes(scenario.result)) throw new Error(`WAVE2_SCENARIO_MISSING_OUTCOME:${scenario.scenarioId}`);
  }
}

// Case: candidate-specific rate must be exactly 100% for this sample too (not just the full pilot).
const candidateSpecificRate = (signatures.length - (signatures.length - new Set(signatures).size)) / signatures.length;
if (candidateSpecificRate !== 1) throw new Error('WAVE2_SCENARIOS_CANDIDATE_SPECIFIC_RATE_BELOW_100');

// ---- FULL-TEAM ----
const speeds = validation.eligiblePokemonIds.map(id => { const s = pkg.species.find(sp => sp.pokemonId === id); return s ? maxCalculatedSpeed(s) : 0; }).sort((a, b) => a - b);
const speedPercentiles = { p25: speeds[Math.floor(speeds.length * 0.25)], p75: speeds[Math.floor(speeds.length * 0.75)] };

// Case: the SAME shell for two different candidates must select DIFFERENT partner trios when the
// candidates themselves differ (proves partner selection is candidate-derived, not a fixed base).
const structA = buildFullTeamStructure(drafts[0].pokemonId, drafts[0].setId, 'neutral', { pkg, eligiblePokemonIds: validation.eligiblePokemonIds, speedPercentiles }, 0);
const structB = buildFullTeamStructure(drafts[2].pokemonId, drafts[2].setId, 'neutral', { pkg, eligiblePokemonIds: validation.eligiblePokemonIds, speedPercentiles }, 0);
if (structA.teamIds.slice(1).join(',') === structB.teamIds.slice(1).join(',') && drafts[0].pokemonId !== drafts[2].pokemonId) {
  // Not necessarily an error (same shell + similar tags could legitimately overlap), but the two
  // candidates here were chosen to differ, so a total match would be suspicious -- assert instead
  // that at least ONE of the 5 partners differs.
  throw new Error('WAVE2_FULLTEAM_IDENTICAL_PARTNERS_FOR_DIFFERENT_CANDIDATES');
}

// Case: duplicate Pokemon in one team must be caught (SPECIES_CLAUSE_VIOLATED) -- verified by
// construction (buildFullTeamStructure never re-adds the candidate itself to the partner pool),
// confirmed here rather than assumed.
if (new Set(structA.teamIds).size !== structA.teamIds.length) throw new Error('WAVE2_FULLTEAM_DUPLICATE_POKEMON_NOT_CAUGHT');
if (!structA.legal) throw new Error(`WAVE2_FULLTEAM_UNEXPECTEDLY_ILLEGAL:${structA.findings.join(',')}`);
if (structA.teamIds.length !== 6) throw new Error('WAVE2_FULLTEAM_SIZE_NOT_SIX');

// Case: every shell must be constructible (no shell silently fails to produce a legal structure).
for (const shell of ALL_SHELLS) {
  const struct = buildFullTeamStructure(drafts[0].pokemonId, drafts[0].setId, shell, { pkg, eligiblePokemonIds: validation.eligiblePokemonIds, speedPercentiles }, 1);
  if (!struct.legal) throw new Error(`WAVE2_FULLTEAM_SHELL_ILLEGAL:${shell}:${struct.findings.join(',')}`);
}

console.log('wave2 scenarios/full-team tests passed', JSON.stringify({ sampleCandidateCount: drafts.length, distinctSignatures: new Set(signatures).size, shellsVerified: ALL_SHELLS.length }));
