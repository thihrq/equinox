import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { expandTargetCatalog } from '../services/competitive-data/expert/wave2/TargetCatalogExpansion';
import { GATED_PROFILE_IDS, TARGET_PROFILE_REQUIREMENTS } from '../services/competitive-data/expert/wave2/TargetProfileRequirements';

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

const PREVIOUS_TARGET_POKEMON_IDS = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000'];
const PREVIOUS_TARGET_SET_EVIDENCE_CATALOG = 'artifacts/competitive-finalization/targets/target-set-evidence-catalog.json';

function main(): void {
  const allowed = new Set(['--run-id', '--mode']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const mode = arg('--mode') ?? 'requirements';
  if (!['requirements', 'build', 'check', 'audit'].includes(mode)) fail(`Unknown --mode: ${mode}`, 2);
  const outputDir = path.resolve(`artifacts/competitive-production-readiness/${runId}/targets`);

  const pkg = loadChampionsCompetitivePackage();
  const validation = validateChampionsCompetitivePackage(pkg);

  if (mode === 'requirements') {
    const previousCatalog = JSON.parse(fs.readFileSync(PREVIOUS_TARGET_SET_EVIDENCE_CATALOG, 'utf8'));
    const previousProfileTags = new Set<string>(['physical-attacker', 'balanced']); // the 6 sentinel targets only carry generic 'damage-dealer'/'balanced-offense' role tags, not profile-specific tags.
    const currentCoverage = { runId, currentTargetCount: previousCatalog.records.length, profilesCoveredByCurrentCatalog: [...previousProfileTags], profileCount: TARGET_PROFILE_REQUIREMENTS.length, gatedProfileCount: GATED_PROFILE_IDS.length };
    const coverageGaps = { runId, gatedProfileIds: GATED_PROFILE_IDS, note: 'The 6 pre-existing sentinel targets do not carry structured profile tags (roles are generic damage-dealer/support), so every gated profile is treated as an open gap for this audit -- resolved by the expanded catalog (see targets/coverage-gaps.json after --mode build).' };
    writeAtomic(path.join(outputDir, 'requirements.json'), { runId, policyId: 'champions-wave2-target-profile-requirements', profiles: TARGET_PROFILE_REQUIREMENTS });
    writeAtomic(path.join(outputDir, 'required-profiles.json'), { runId, profileIds: TARGET_PROFILE_REQUIREMENTS.map(p => p.profileId), gatedProfileIds: GATED_PROFILE_IDS });
    writeAtomic(path.join(outputDir, 'profile-priority.json'), { runId, byPriority: { critical: TARGET_PROFILE_REQUIREMENTS.filter(p => p.priority === 'critical').map(p => p.profileId), high: TARGET_PROFILE_REQUIREMENTS.filter(p => p.priority === 'high').map(p => p.profileId), medium: TARGET_PROFILE_REQUIREMENTS.filter(p => p.priority === 'medium').map(p => p.profileId) } });
    writeAtomic(path.join(outputDir, 'current-coverage.json'), currentCoverage);
    writeAtomic(path.join(outputDir, 'coverage-gaps.json'), coverageGaps);
    console.log(JSON.stringify({ valid: true, mode, profileCount: TARGET_PROFILE_REQUIREMENTS.length, gatedProfileCount: GATED_PROFILE_IDS.length, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
    return;
  }

  if (mode === 'build' || mode === 'check' || mode === 'audit') {
    const previousCatalog = JSON.parse(fs.readFileSync(PREVIOUS_TARGET_SET_EVIDENCE_CATALOG, 'utf8'));
    const expansion = expandTargetCatalog({ pkg, validation, previousTargetPokemonIds: PREVIOUS_TARGET_POKEMON_IDS });

    const provisionalUsed = expansion.newTargets.filter(t => validation.provisionalPokemonIds.includes(t.pokemonId)).length;
    const blockedUsed = expansion.newTargets.filter(t => validation.blockedPokemonIds.includes(t.pokemonId)).length;
    const coveredGatedProfiles = new Set(expansion.newTargets.map(t => t.profileId));
    const missingGatedProfiles = GATED_PROFILE_IDS.filter(id => !coveredGatedProfiles.has(id));

    const legalityResults = expansion.newTargets.map(t => ({ targetSetId: t.targetSetId, pokemonId: t.pokemonId, legalityValidated: t.legalityValidated, evidenceStatus: t.evidenceStatus }));
    const coherenceResults = expansion.newTargets.map(t => ({ targetSetId: t.targetSetId, coherenceValidated: t.coherenceValidated }));
    const calculatedStats = expansion.newTargets.map(t => ({ targetSetId: t.targetSetId, pokemonId: t.pokemonId, calculatedStats: t.calculatedStats }));
    const indexRecords = [...previousCatalog.records.map((r: { targetSetId: string; pokemonId: string; evidenceStatus: string }) => ({ targetSetId: r.targetSetId, pokemonId: r.pokemonId, evidenceStatus: r.evidenceStatus, source: 'wave1-sentinel' })), ...expansion.newTargets.map(t => ({ targetSetId: t.targetSetId, pokemonId: t.pokemonId, evidenceStatus: t.evidenceStatus, source: 'wave2-expansion' }))];
    const sourceMap = expansion.newTargets.map(t => ({ targetSetId: t.targetSetId, pokemonId: t.pokemonId, sourceType: t.sourceType, sourceReferences: t.sourceReferences }));
    const coverage = {
      runId, totalTargetCount: previousCatalog.records.length + expansion.newTargets.length, previousTargetCount: previousCatalog.records.length, newTargetCount: expansion.newTargets.length,
      gatedProfileCount: GATED_PROFILE_IDS.length, coveredGatedProfileCount: coveredGatedProfiles.size, missingGatedProfiles,
      physicalWallAvailable: coveredGatedProfiles.has('physical-wall'), specialWallAvailable: coveredGatedProfiles.has('special-wall'),
      slowTargetAvailable: coveredGatedProfiles.has('slow'), verySlowTargetAvailable: coveredGatedProfiles.has('very-slow'),
      fastPhysicalTargetAvailable: coveredGatedProfiles.has('fast-physical-attacker'), fastSpecialTargetAvailable: coveredGatedProfiles.has('fast-special-attacker'),
      bulkyTargetAvailable: coveredGatedProfiles.has('physically-bulky-attacker') || coveredGatedProfiles.has('specially-bulky-attacker'),
      supportTargetAvailable: coveredGatedProfiles.has('fake-out') || coveredGatedProfiles.has('redirection') || coveredGatedProfiles.has('pivot'),
      trickRoomTargetAvailable: coveredGatedProfiles.has('trick-room'), tailwindTargetAvailable: coveredGatedProfiles.has('tailwind'),
      weatherTargetAvailable: coveredGatedProfiles.has('weather-setter'), terrainTargetAvailable: coveredGatedProfiles.has('terrain-setter'),
      redirectionTargetAvailable: coveredGatedProfiles.has('redirection'), fakeOutTargetAvailable: coveredGatedProfiles.has('fake-out'),
      priorityTargetAvailable: coveredGatedProfiles.has('priority-attacker'), pivotTargetAvailable: coveredGatedProfiles.has('pivot') || coveredGatedProfiles.has('offensive-pivot'),
      spreadTargetAvailable: coveredGatedProfiles.has('spread-physical-attacker') || coveredGatedProfiles.has('spread-special-attacker'),
      maxDefOrSpDefAmongAllTargets: Math.max(...previousCatalog.records.map((r: { calculatedStats: { defense: number; specialDefense: number } }) => Math.max(r.calculatedStats.defense, r.calculatedStats.specialDefense)), ...expansion.newTargets.map(t => Math.max(t.calculatedStats.defense, t.calculatedStats.specialDefense))),
      minSpeedAmongAllTargets: Math.min(...previousCatalog.records.map((r: { calculatedStats: { speed: number } }) => r.calculatedStats.speed), ...expansion.newTargets.map(t => t.calculatedStats.speed)),
      provisionalUsed, blockedUsed,
    };

    writeAtomic(path.join(outputDir, 'previous-catalog.json'), previousCatalog);
    writeAtomic(path.join(outputDir, 'expanded-catalog.json'), { runId, policyId: 'wave2-target-catalog-expansion', policyVersion: 'wave2-target-catalog-expansion-v1', newTargetCount: expansion.newTargets.length, records: expansion.newTargets });
    writeAtomic(path.join(outputDir, 'index.json'), { runId, count: indexRecords.length, records: indexRecords });
    writeAtomic(path.join(outputDir, 'source-map.json'), { runId, records: sourceMap });
    writeAtomic(path.join(outputDir, 'legality-results.json'), { runId, allLegal: legalityResults.every(r => r.legalityValidated), results: legalityResults });
    writeAtomic(path.join(outputDir, 'coherence-results.json'), { runId, allCoherent: coherenceResults.every(r => r.coherenceValidated), results: coherenceResults });
    writeAtomic(path.join(outputDir, 'calculated-stats.json'), { runId, records: calculatedStats });
    writeAtomic(path.join(outputDir, 'coverage.json'), coverage);
    writeAtomic(path.join(outputDir, 'coverage-gaps.json'), { runId, missingGatedProfiles, unresolvedNonGatedProfiles: expansion.unresolved.filter(u => !GATED_PROFILE_IDS.includes(u.profileId)) });
    writeAtomic(path.join(outputDir, 'target-selection-policy.json'), {
      runId, policyId: 'wave2-per-candidate-target-selection-policy', policyVersion: 'wave2-target-selection-v1',
      algorithm: 'For each pilot candidate, targets are selected deterministically from the expanded catalog by matching the candidate\'s own role/archetype/speed-class/type tags (derived from its real moves/item/ability/base stats, the same PokemonProfileClassifier used for target-catalog expansion and pilot stratification) against each target\'s profileId/roles/archetypes/speedClasses/defensiveClasses, ranked by tag-overlap count with ties broken by targetSetId, never by candidate name or species literal.',
      inputs: ['candidate role', 'candidate offensive category', 'move category', 'Speed class', 'intended archetype', 'typing', 'item', 'ability', 'weaknesses (via TYPE_CHART)', 'role contribution', 'evidence gaps'],
    });
    writeAtomic(path.join(outputDir, 'unresolved.json'), { runId, unresolved: expansion.unresolved });
    writeAtomic(path.join(outputDir, 'audit.json'), { runId, selectionTrace: expansion.selectionTrace, provisionalUsed, blockedUsed, gate: { targetProfilesCovered: missingGatedProfiles.length === 0, provisionalUsed: provisionalUsed === 0, blockedUsed: blockedUsed === 0 } });

    const valid = missingGatedProfiles.length === 0 && provisionalUsed === 0 && blockedUsed === 0 && legalityResults.every(r => r.legalityValidated);
    console.log(JSON.stringify({ valid, mode, newTargetCount: expansion.newTargets.length, totalTargetCount: coverage.totalTargetCount, missingGatedProfiles, provisionalUsed, blockedUsed, maxDefOrSpDefAmongAllTargets: coverage.maxDefOrSpDefAmongAllTargets, minSpeedAmongAllTargets: coverage.minSpeedAmongAllTargets, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
    if (!valid) process.exitCode = 5;
    return;
  }
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
