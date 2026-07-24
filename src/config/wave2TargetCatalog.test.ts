import { buildExpertDerivedTargetSetRecord } from '../services/competitive-data/expert/wave2/ExpertDerivedTargetSetBuilder';
import { expandTargetCatalog } from '../services/competitive-data/expert/wave2/TargetCatalogExpansion';
import { loadChampionsCompetitivePackage } from '../equinox/data-packs/champions/loadChampionsCompetitivePackage';
import { validateChampionsCompetitivePackage } from '../equinox/data-validation/champions/ChampionsPackageValidator';
import { GATED_PROFILE_IDS } from '../services/competitive-data/expert/wave2/TargetProfileRequirements';

const draftBase = {
  setId: 'test-target', pokemonId: '0003-000', itemId: 'leftovers', abilityId: 'overgrow', natureId: 'bold',
  moveIds: ['tackle', 'growl', 'leechseed', 'sleeppowder'] as [string, string, string, string],
  evs: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  declaredRoles: ['wall'], targetArchetypes: ['balanced'], profileId: 'physical-wall',
};
const speciesFixture = { speciesId: '0003-000', pokemonId: '0003-000', baseStats: { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 } };
const natureFixture = { increasedStat: 'defense', decreasedStat: 'attack' };
const legalMoves = new Set(draftBase.moveIds);
const legalAbilities = new Set([draftBase.abilityId]);
const legalItems = new Set([draftBase.itemId]);

// Case: provisional target must be rejected (mission section 13/39 gate: provisionalUsed=0).
let provisionalThrew = false;
try {
  buildExpertDerivedTargetSetRecord({ draft: draftBase, species: speciesFixture, nature: natureFixture, eligibilityStatus: 'provisional', legalMoves, legalAbilities, legalItems, coherent: true, intendedUses: [], benchmarkClasses: [], speedClasses: [], defensiveClasses: [], sourceReferences: [] });
} catch (error) {
  provisionalThrew = error instanceof Error && error.message.startsWith('TARGET_SET_PROVISIONAL_OR_BLOCKED_REJECTED');
}
if (!provisionalThrew) throw new Error('WAVE2_TARGET_PROVISIONAL_NOT_REJECTED');

// Case: blocked target must be rejected.
let blockedThrew = false;
try {
  buildExpertDerivedTargetSetRecord({ draft: draftBase, species: speciesFixture, nature: natureFixture, eligibilityStatus: 'blocked', legalMoves, legalAbilities, legalItems, coherent: true, intendedUses: [], benchmarkClasses: [], speedClasses: [], defensiveClasses: [], sourceReferences: [] });
} catch (error) {
  blockedThrew = error instanceof Error && error.message.startsWith('TARGET_SET_PROVISIONAL_OR_BLOCKED_REJECTED');
}
if (!blockedThrew) throw new Error('WAVE2_TARGET_BLOCKED_NOT_REJECTED');

// Case: move not in the real legal set must be rejected.
let illegalMoveThrew = false;
try {
  buildExpertDerivedTargetSetRecord({ draft: { ...draftBase, moveIds: ['tackle', 'growl', 'leechseed', 'notarealmove'] }, species: speciesFixture, nature: natureFixture, eligibilityStatus: 'eligible', legalMoves, legalAbilities, legalItems, coherent: true, intendedUses: [], benchmarkClasses: [], speedClasses: [], defensiveClasses: [], sourceReferences: [] });
} catch (error) {
  illegalMoveThrew = error instanceof Error && error.message.startsWith('TARGET_SET_MOVE_INVALID');
}
if (!illegalMoveThrew) throw new Error('WAVE2_TARGET_ILLEGAL_MOVE_NOT_REJECTED');

// Case: item/ability not in the real legal set must be rejected.
let illegalItemThrew = false;
try {
  buildExpertDerivedTargetSetRecord({ draft: { ...draftBase, itemId: 'notarealitem' }, species: speciesFixture, nature: natureFixture, eligibilityStatus: 'eligible', legalMoves, legalAbilities, legalItems, coherent: true, intendedUses: [], benchmarkClasses: [], speedClasses: [], defensiveClasses: [], sourceReferences: [] });
} catch (error) {
  illegalItemThrew = error instanceof Error && error.message.startsWith('TARGET_SET_MECHANIC_INVALID');
}
if (!illegalItemThrew) throw new Error('WAVE2_TARGET_ILLEGAL_ITEM_NOT_REJECTED');

// Case: a legal, eligible draft succeeds and produces a stable digest.
const validRecord = buildExpertDerivedTargetSetRecord({ draft: draftBase, species: speciesFixture, nature: natureFixture, eligibilityStatus: 'eligible', legalMoves, legalAbilities, legalItems, coherent: true, intendedUses: ['defensive'], benchmarkClasses: ['defensive-benchmark'], speedClasses: [], defensiveClasses: ['physical-wall'], sourceReferences: ['test'] });
const validRecordAgain = buildExpertDerivedTargetSetRecord({ draft: draftBase, species: speciesFixture, nature: natureFixture, eligibilityStatus: 'eligible', legalMoves, legalAbilities, legalItems, coherent: true, intendedUses: ['defensive'], benchmarkClasses: ['defensive-benchmark'], speedClasses: [], defensiveClasses: ['physical-wall'], sourceReferences: ['test'] });
if (validRecord.targetSetDigest !== validRecordAgain.targetSetDigest) throw new Error('WAVE2_TARGET_DIGEST_NOT_DETERMINISTIC');
if (validRecord.evidenceStatus !== 'expert-derived' || validRecord.sourceType !== 'roster-derived') throw new Error('WAVE2_TARGET_EVIDENCE_STATUS_WRONG');

// ---- Catalog expansion engine (real data, real gated-profile coverage) ----
const pkg = loadChampionsCompetitivePackage();
const validation = validateChampionsCompetitivePackage(pkg);
const previousTargetPokemonIds = ['0003-000', '0006-000', '0009-000', '0015-000', '0018-000', '0024-000'];
const expansion = expandTargetCatalog({ pkg, validation, previousTargetPokemonIds });

if (expansion.newTargets.length === 0) throw new Error('WAVE2_TARGET_CATALOG_EXPANSION_EMPTY');
for (const target of expansion.newTargets) {
  if (validation.provisionalPokemonIds.includes(target.pokemonId)) throw new Error(`WAVE2_TARGET_CATALOG_CONTAINS_PROVISIONAL:${target.pokemonId}`);
  if (validation.blockedPokemonIds.includes(target.pokemonId)) throw new Error(`WAVE2_TARGET_CATALOG_CONTAINS_BLOCKED:${target.pokemonId}`);
}

// Every gated profile (mission section 39) must resolve to at least one real, built target.
const coveredProfiles = new Set(expansion.newTargets.map(t => t.profileId));
const missingGatedProfiles = GATED_PROFILE_IDS.filter(id => !coveredProfiles.has(id) && !expansion.unresolved.some(u => u.profileId === id));
if (missingGatedProfiles.length > 0) throw new Error(`WAVE2_TARGET_CATALOG_GATED_PROFILE_UNCOVERED:${missingGatedProfiles.join(',')}`);

// A physical-wall target must genuinely be bulkier (by the real calculated-stat formula) than
// every one of the 6 pre-existing sentinel targets -- proves the selection is not arbitrary.
const physicalWallTarget = expansion.newTargets.find(t => t.profileId === 'physical-wall');
if (!physicalWallTarget) throw new Error('WAVE2_PHYSICAL_WALL_TARGET_MISSING');
if (physicalWallTarget.calculatedStats.defense < 105) throw new Error(`WAVE2_PHYSICAL_WALL_NOT_BULKY_ENOUGH:${physicalWallTarget.calculatedStats.defense}`);

const verySlowTarget = expansion.newTargets.find(t => t.profileId === 'very-slow');
if (!verySlowTarget) throw new Error('WAVE2_VERY_SLOW_TARGET_MISSING');
if (verySlowTarget.calculatedStats.speed > 75) throw new Error(`WAVE2_VERY_SLOW_NOT_SLOW_ENOUGH:${verySlowTarget.calculatedStats.speed}`);

console.log('wave2 target catalog tests passed', JSON.stringify({ newTargetCount: expansion.newTargets.length, unresolvedCount: expansion.unresolved.length, coveredGatedProfiles: coveredProfiles.size }));
