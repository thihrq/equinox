import fs from 'fs';
import path from 'path';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { buildSpeciesMoveContext, classifyStrata, maxCalculatedSpeed } from '../services/competitive-data/expert/wave2/PokemonProfileClassifier';
import { ALL_SHELLS, buildFullTeamStructure, FullTeamShell } from '../services/competitive-data/expert/wave2/FullTeamDiversityEngine';
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

function dominantShellFor(pokemonId: string, pkg: ReturnType<typeof loadChampionsCompetitivePackage>, speedPercentiles: { p25: number; p75: number }): FullTeamShell {
  const species = pkg.species.find(s => s.pokemonId === pokemonId)!;
  const ctx = buildSpeciesMoveContext(species, pkg);
  const strata = classifyStrata(species, ctx, speedPercentiles);
  if (strata.trickRoomCapable) return 'trick-room';
  if (strata.tailwindCapable) return 'tailwind';
  if (strata.weatherSetter) return 'weather';
  if (strata.terrainSetter) return 'terrain';
  if (strata.redirectionCapable || strata.fakeOutCapable) return 'support-heavy';
  if (strata.wallPhysical || strata.wallSpecial) return 'defensive';
  return 'offensive';
}

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const runDir = path.resolve(`artifacts/competitive-production-readiness/${runId}`);
  const pilotDir = path.join(runDir, 'pilot');
  const fullTeamDir = path.join(runDir, 'full-team');
  const candidatesPath = path.join(pilotDir, 'candidates.json');
  if (!fs.existsSync(candidatesPath)) fail(`Missing pilot artifact -- run pilot:generate first: ${candidatesPath}`, 12);

  const pkg = loadChampionsCompetitivePackage();
  const validation = validateChampionsCompetitivePackage(pkg);
  const drafts = JSON.parse(fs.readFileSync(candidatesPath, 'utf8')).drafts as CurationSetDraft[];

  const speeds = validation.eligiblePokemonIds.map(id => { const s = pkg.species.find(sp => sp.pokemonId === id); return s ? maxCalculatedSpeed(s) : 0; }).sort((a, b) => a - b);
  const percentile = (p: number) => speeds[Math.floor(speeds.length * p)] ?? speeds[speeds.length - 1];
  const speedPercentiles = { p25: percentile(0.25), p75: percentile(0.75) };

  const MIN_STRUCTURES_PER_CANDIDATE = 5; // matches Stage4's own runFullTeamSpecialist threshold (fullTeamEvidenceCount >= 5); fewer would leave every real candidate evidence-incomplete regardless of quality.
  const structures = drafts.flatMap((draft, draftIndex) => {
    const dominant = dominantShellFor(draft.pokemonId, pkg, speedPercentiles);
    const shells: FullTeamShell[] = [dominant, 'neutral', 'low-synergy-stress'];
    for (let offset = 0; shells.length < MIN_STRUCTURES_PER_CANDIDATE; offset += 1) {
      const candidate = ALL_SHELLS[(draftIndex + offset) % ALL_SHELLS.length];
      if (!shells.includes(candidate)) shells.push(candidate);
    }
    return shells.map((shell, shellIndex) => buildFullTeamStructure(draft.pokemonId, draft.setId, shell, { pkg, eligiblePokemonIds: validation.eligiblePokemonIds, speedPercentiles }, draftIndex * 10 + shellIndex));
  });

  const partnerSets = structures.map(s => s.members.slice(1).map(m => m.pokemonId).sort().join(','));
  const distinctPartnerTrios = new Set(partnerSets).size;
  const perCandidateStructureCount = new Map<string, number>();
  for (const s of structures) perCandidateStructureCount.set(s.setId, (perCandidateStructureCount.get(s.setId) ?? 0) + 1);
  const candidateHasMultipleTeamContexts = [...perCandidateStructureCount.values()].every(count => count > 1);
  const legalCount = structures.filter(s => s.legal).length;
  const samePartnerTrioForAllCandidates = distinctPartnerTrios === 1;
  const stressStructures = structures.filter(s => s.shell === 'low-synergy-stress');
  const neutralStructures = structures.filter(s => s.shell === 'neutral');

  writeAtomic(path.join(fullTeamDir, 'partner-selection-policy.json'), {
    runId, policyId: 'wave2-partner-selection-policy', policyVersion: 'wave2-partner-selection-v1',
    shells: ALL_SHELLS,
    algorithm: 'Per candidate, build one structure per selected shell (the candidate\'s own dominant real tag, "neutral", "low-synergy-stress", and one shell rotating deterministically by candidate index). Partners are the top-5 eligible, non-self species ranked by real tag-overlap with the shell (or, for low-synergy-stress, ranked by LOWEST overlap with offensive/defensive/support-heavy -- a genuine stress context, not a synergy-maximizing pick). Items are assigned from each member\'s real legal item pool, deduplicated across the team to satisfy Item Clause.',
  });
  writeAtomic(path.join(fullTeamDir, 'candidate-partner-matrix.json'), { runId, records: structures.map(s => ({ structureId: s.structureId, setId: s.setId, shell: s.shell, partnerPokemonIds: s.members.slice(1).map(m => m.pokemonId) })) });
  writeAtomic(path.join(fullTeamDir, 'full-team-structures.json'), { runId, count: structures.length, structures });
  writeAtomic(path.join(fullTeamDir, 'partner-fingerprints.json'), { runId, distinctPartnerTrios, fingerprints: [...new Set(partnerSets)] });
  writeAtomic(path.join(fullTeamDir, 'partner-reuse-report.json'), { runId, distinctPartnerTrios, totalStructures: structures.length, partnerReuseRatio: structures.length > 0 ? Number((1 - distinctPartnerTrios / structures.length).toFixed(3)) : 0, samePartnerTrioForAllCandidates });
  writeAtomic(path.join(fullTeamDir, 'full-team-diversity-report.json'), {
    runId, totalStructures: structures.length, distinctPartnerTrios, structuresPerCandidateMin: Math.min(...perCandidateStructureCount.values()), structuresPerCandidateMax: Math.max(...perCandidateStructureCount.values()),
    neutralStructureCount: neutralStructures.length, stressStructureCount: stressStructures.length, legalCount, fullTeamLegalityRate: structures.length > 0 ? Math.round((legalCount / structures.length) * 100) : 0,
    candidateHasMultipleTeamContexts, samePartnerTrioForAllCandidates, stressContextCoverage: stressStructures.length === drafts.length,
  });
  writeAtomic(path.join(fullTeamDir, 'partner-dependency-report.json'), {
    runId, distinctPartnerTrios, sameBasePartnersAcrossAllCandidates: samePartnerTrioForAllCandidates,
    finding: samePartnerTrioForAllCandidates ? 'All candidates share the identical partner trio -- partner dependency cannot be measured.' : `${distinctPartnerTrios} distinct partner combinations observed across ${structures.length} structures; partner dependency is measurable per-candidate by comparing scenario/benchmark outcomes across a candidate's own multiple shells.`,
    excessivePartnerDependency: samePartnerTrioForAllCandidates,
  });

  const valid = !samePartnerTrioForAllCandidates && candidateHasMultipleTeamContexts && distinctPartnerTrios > 1 && legalCount === structures.length && stressStructures.length === drafts.length;
  console.log(JSON.stringify({ valid, totalStructures: structures.length, distinctPartnerTrios, fullTeamLegalityRate: structures.length > 0 ? Math.round((legalCount / structures.length) * 100) : 0, candidateHasMultipleTeamContexts, samePartnerTrioForAllCandidates, stressContextCoverage: stressStructures.length === drafts.length, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
  if (!valid) process.exitCode = 10;
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 25; }
}
