import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { CompetitivePokemonSet } from '../equinox/competitive/CompetitivePokemonSet';
import { calculateTeamDataCoverage } from '../equinox/competitive/TeamDataCoverage';
import { PokemonData } from '../equinox/core/AnalysisContext';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
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
    setSource: 'v2-draft',
    validation: { legal: true, errors: [], warnings: [] },
  };
}

const sinistcha = toCompetitiveSet('sinistcha-bulky-trick-room-setter-draft');
const aggron = toCompetitiveSet('aggronmega-slow-physical-breaker-draft');

assert(sinistcha.role === 'trick-room-setter', 'Sinistcha must select the bulky trick-room-setter role.');
assert(aggron.role === 'slow-physical-breaker', 'Aggron-Mega must select the slow physical breaker role.');
assert(sinistcha.ivs.spe === 0, 'Sinistcha Trick Room set must preserve 0 Spe IV.');
assert(aggron.ivs.spe === 0, 'Aggron-Mega slow breaker set must preserve 0 Spe IV.');

const team: PokemonData[] = [
  { name: 'Sinistcha', types: ['Grass', 'Ghost'], competitiveSet: sinistcha },
  { name: 'Aggron-Mega', types: ['Steel'], competitiveSet: aggron },
  ...['Incineroar', 'Togekiss', 'Ursaluna-Bloodmoon', 'Muk-Alola'].map(name => ({
    name,
    types: [],
    competitiveSet: {
      name,
      types: [],
      item: 'Sitrus Berry',
      ability: 'Unknown',
      nature: 'Serious',
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      moves: ['Protect', 'Helping Hand', 'Substitute', 'Tera Blast'] as [string, string, string, string],
      setSource: 'generated' as const,
      validation: { legal: true, errors: [], warnings: [] },
    },
  })),
];

const coverage = calculateTeamDataCoverage(team);
assert(coverage.draftSets === 2, 'Team coverage must count two V2 draft sets.');
assert(coverage.generatedFallbacks === 4, 'Team coverage must count generated fallbacks.');
assert(coverage.competitiveIndexCap === 65, 'Three or more generated fallbacks must cap competitive index at 65.');
assert(coverage.confidenceScore <= 70, 'Less than four verified sets must cap data confidence at 70.');

console.log('[Equinox] V2 Team Builder shadow selection validation passed.');
console.log(JSON.stringify({
  sinistcha: { setId: sinistcha.setId, source: sinistcha.setSource, roleFit: 'high', speIv: sinistcha.ivs.spe },
  aggron: { setId: aggron.setId, source: aggron.setSource, roleFit: 'high', speIv: aggron.ivs.spe },
  coverage,
}, null, 2));
