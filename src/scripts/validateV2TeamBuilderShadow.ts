import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { CompetitivePokemonSet, CompetitiveSetSource } from '../equinox/competitive/CompetitivePokemonSet';
import { calculateTeamDataCoverage } from '../equinox/competitive/TeamDataCoverage';
import { PokemonData } from '../equinox/core/AnalysisContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function sourceFromStatus(status?: string): CompetitiveSetSource {
  if (status === 'verified' || status === 'active') return 'v2-verified';
  if (status === 'reviewed') return 'v2-reviewed';
  if (status === 'draft') return 'v2-draft';
  return 'unknown';
}

function toCompetitiveSet(setId: string): CompetitivePokemonSet {
  const record = pilotPack.sets.find(set => set.setId === setId);
  assert(Boolean(record), `Missing pilot set: ${setId}`);
  return {
    name: record!.pokemonName,
    types: [],
    item: record!.item,
    ability: record!.ability,
    nature: record!.nature,
    evs: record!.evs,
    ivs: record!.ivs,
    moves: record!.moves as [string, string, string, string],
    role: record!.primaryRole,
    level: 50,
    setId: record!.setId,
    confidence: record!.confidence,
    status: record!.status,
    sourceType: record!.sourceType,
    setSource: sourceFromStatus(record!.status),
    validation: { legal: true, errors: [], warnings: [] },
  };
}

function generatedSet(name: string): CompetitivePokemonSet {
  return {
    name,
    types: [],
    item: name === 'Togekiss' ? 'Safety Goggles' : 'Black Sludge',
    ability: 'Unknown',
    nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Protect', 'Helping Hand', 'Substitute', 'Tera Blast'] as [string, string, string, string],
    setSource: 'generated',
    validation: { legal: true, errors: [], warnings: [] },
  };
}

const sinistcha = toCompetitiveSet('sinistcha-bulky-trick-room-setter-draft');
const aggron = toCompetitiveSet('aggronmega-slow-physical-breaker-draft');
const ursaluna = toCompetitiveSet('ursalunabloodmoon-slow-special-breaker-draft');
const incineroar = toCompetitiveSet('incineroar-bulky-slow-pivot-draft');

assert(sinistcha.role === 'trick-room-setter', 'Sinistcha must select the bulky trick-room-setter role.');
assert(aggron.role === 'slow-physical-breaker', 'Aggron-Mega must select the slow physical breaker role.');
assert(ursaluna.role === 'slow-special-breaker', 'Ursaluna-Bloodmoon must select the slow special breaker role.');
assert(incineroar.role === 'bulky-pivot', 'Incineroar must select the bulky pivot role.');
assert(sinistcha.ivs.spe === 0, 'Sinistcha Trick Room set must preserve 0 Spe IV.');
assert(aggron.ivs.spe === 0, 'Aggron-Mega slow breaker set must preserve 0 Spe IV.');
assert(ursaluna.ivs.spe === 0, 'Ursaluna-Bloodmoon slow breaker set must preserve 0 Spe IV.');
assert(sinistcha.setSource === 'v2-reviewed', 'Sinistcha must be promoted to v2-reviewed.');
assert(aggron.setSource === 'v2-reviewed', 'Aggron-Mega must be promoted to v2-reviewed.');
assert(ursaluna.setSource === 'v2-reviewed', 'Ursaluna-Bloodmoon must be promoted to v2-reviewed.');
assert(incineroar.setSource === 'v2-reviewed', 'Incineroar must be promoted to v2-reviewed.');

const team: PokemonData[] = [
  { name: 'Sinistcha', types: ['Grass', 'Ghost'], item: sinistcha.item, ability: sinistcha.ability, nature: sinistcha.nature, moves: sinistcha.moves, competitiveSet: sinistcha },
  { name: 'Aggron-Mega', types: ['Steel'], item: aggron.item, ability: aggron.ability, nature: aggron.nature, moves: aggron.moves, competitiveSet: aggron },
  { name: 'Ursaluna-Bloodmoon', types: ['Ground', 'Normal'], item: ursaluna.item, ability: ursaluna.ability, nature: ursaluna.nature, moves: ursaluna.moves, competitiveSet: ursaluna },
  { name: 'Incineroar', types: ['Fire', 'Dark'], item: incineroar.item, ability: incineroar.ability, nature: incineroar.nature, moves: incineroar.moves, competitiveSet: incineroar },
  { name: 'Togekiss', types: ['Fairy', 'Flying'], competitiveSet: generatedSet('Togekiss') },
  { name: 'Muk-Alola', types: ['Poison', 'Dark'], competitiveSet: generatedSet('Muk-Alola') },
];

for (const member of team) {
  const set = member.competitiveSet;
  assert(Boolean(set), `Missing competitiveSet for ${member.name}`);
  if (member.item) assert(member.item === set!.item, `UI item must use the same set object for ${member.name}`);
  if (member.ability) assert(member.ability === set!.ability, `UI ability must use the same set object for ${member.name}`);
  if (member.nature) assert(member.nature === set!.nature, `UI nature must use the same set object for ${member.name}`);
  if (member.moves) assert(JSON.stringify(member.moves) === JSON.stringify(set!.moves), `UI moves must use the same set object for ${member.name}`);
}

const coverage = calculateTeamDataCoverage(team);
assert(coverage.reviewedSets === 4, 'Team coverage must count four V2 reviewed sets.');
assert(coverage.draftSets === 0, 'Reviewed homologation case must not count draft sets.');
assert(coverage.generatedFallbacks === 2, 'Team coverage must count two generated fallbacks.');
assert(coverage.competitiveIndexCap > 70, 'Two fallbacks must not trigger the 65 competitive cap.');
assert(coverage.confidenceScore > 60, 'Four reviewed sets plus two fallbacks must raise confidence above 60.');
assert(coverage.confidenceScore <= 70, 'Less than four verified sets must still cap data confidence at 70.');
assert(coverage.verifiedCompetitiveLabel === false, 'Reviewed-only teams must not receive a verified competitive label.');

console.log('[Equinox] V2 Team Builder shadow selection validation passed.');
console.log(JSON.stringify({
  sinistcha: { setId: sinistcha.setId, source: sinistcha.setSource, roleFit: 'high', speIv: sinistcha.ivs.spe },
  aggron: { setId: aggron.setId, source: aggron.setSource, roleFit: 'high', speIv: aggron.ivs.spe },
  ursaluna: { setId: ursaluna.setId, source: ursaluna.setSource, roleFit: 'high', speIv: ursaluna.ivs.spe },
  incineroar: { setId: incineroar.setId, source: incineroar.setSource, roleFit: 'high' },
  coverage,
}, null, 2));
