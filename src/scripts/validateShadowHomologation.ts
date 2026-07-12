import legacyPack from '../equinox/data-packs/sets-data-pack.json';
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { compareLegacyAndV2Sets, SetSelectionComparison } from '../equinox/competitive/CompetitiveSetShadowComparator';
import { CompetitivePokemonSet, CompetitiveSetSource } from '../equinox/competitive/CompetitivePokemonSet';
import { calculateTeamDataCoverage, TeamDataCoverage } from '../equinox/competitive/TeamDataCoverage';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';
import { PokemonData } from '../equinox/core/AnalysisContext';

interface HomologationScenario {
  id: string;
  label: string;
  lead: [string, string];
  teamSlots: string[];
  winCondition: string;
  quartet: [string, string, string, string];
  expectedV2Minimum: number;
  expectedFallbackMaximum: number;
}

interface HomologationScenarioResult {
  id: string;
  label: string;
  lead: [string, string];
  setSources: Array<{ pokemon: string; source: CompetitiveSetSource; setId?: string; role?: string }>;
  comparisons: SetSelectionComparison[];
  coverage: TeamDataCoverage;
  rawStrategicScore: number;
  dataConfidence: number;
  confidenceCap: number;
  finalCompetitiveScore: number;
  v2PreferenceRate: number;
  manualReviewRate: number;
  fallbackRate: number;
  verifiedCoverage: number;
  coherenceAverage: number;
  legalityFailureRate: number;
  roleMismatchRate: number;
  exportMismatchRate: number;
  quartet: [string, string, string, string];
  winCondition: string;
}

const scenarios: HomologationScenario[] = [
  {
    id: 'sinistcha-aggron-trick-room',
    label: 'Sinistcha + Aggron-Mega',
    lead: ['Sinistcha', 'Aggron-Mega'],
    teamSlots: ['Sinistcha', 'Aggron-Mega', 'Ursaluna-Bloodmoon', 'Incineroar', 'Togekiss', 'Muk-Alola'],
    quartet: ['Sinistcha', 'Aggron-Mega', 'Ursaluna-Bloodmoon', 'Incineroar'],
    winCondition: 'Trick Room pressure with slow physical and special breakers.',
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'indeedee-hatterene-psychic-room',
    label: 'Indeedee-F + Hatterene',
    lead: ['Indeedee-F', 'Hatterene'],
    teamSlots: ['Indeedee-F', 'Hatterene', 'Sinistcha', 'Ursaluna-Bloodmoon', 'Incineroar', 'Togekiss'],
    quartet: ['Indeedee-F', 'Hatterene', 'Sinistcha', 'Ursaluna-Bloodmoon'],
    winCondition: 'Psychic Terrain and Trick Room setup with redirection support.',
    expectedV2Minimum: 3,
    expectedFallbackMaximum: 3,
  },
  {
    id: 'pelipper-basculegion-rain',
    label: 'Pelipper + Basculegion',
    lead: ['Pelipper', 'Basculegion'],
    teamSlots: ['Pelipper', 'Basculegion', 'Incineroar', 'Sinistcha', 'Ursaluna-Bloodmoon', 'Muk-Alola'],
    quartet: ['Pelipper', 'Basculegion', 'Incineroar', 'Sinistcha'],
    winCondition: 'Rain tempo backed by pivoting and late Trick Room resilience.',
    expectedV2Minimum: 3,
    expectedFallbackMaximum: 3,
  },
  {
    id: 'torkoal-lilligant-sun',
    label: 'Torkoal + Lilligant',
    lead: ['Torkoal', 'Lilligant'],
    teamSlots: ['Torkoal', 'Lilligant', 'Ursaluna-Bloodmoon', 'Incineroar', 'Sinistcha', 'Aggron-Mega'],
    quartet: ['Torkoal', 'Lilligant', 'Ursaluna-Bloodmoon', 'Incineroar'],
    winCondition: 'Sun pressure with a slow-room secondary mode.',
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'rillaboom-physical-attacker',
    label: 'Rillaboom + physical attacker',
    lead: ['Rillaboom', 'Aggron-Mega'],
    teamSlots: ['Rillaboom', 'Aggron-Mega', 'Incineroar', 'Sinistcha', 'Ursaluna-Bloodmoon', 'Togekiss'],
    quartet: ['Rillaboom', 'Aggron-Mega', 'Incineroar', 'Sinistcha'],
    winCondition: 'Terrain and Fake Out support for a slow physical win condition.',
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'fast-tailwind-lead',
    label: 'Fast Tailwind lead',
    lead: ['Tornadus', 'Incineroar'],
    teamSlots: ['Tornadus', 'Incineroar', 'Ursaluna-Bloodmoon', 'Sinistcha', 'Aggron-Mega', 'Muk-Alola'],
    quartet: ['Tornadus', 'Incineroar', 'Ursaluna-Bloodmoon', 'Sinistcha'],
    winCondition: 'Tailwind tempo with pivoting into slower backup breakers.',
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'defensive-redirection-lead',
    label: 'Defensive redirection lead',
    lead: ['Sinistcha', 'Ursaluna-Bloodmoon'],
    teamSlots: ['Sinistcha', 'Ursaluna-Bloodmoon', 'Incineroar', 'Aggron-Mega', 'Togekiss', 'Muk-Alola'],
    quartet: ['Sinistcha', 'Ursaluna-Bloodmoon', 'Incineroar', 'Aggron-Mega'],
    winCondition: 'Redirection protects a slow special breaker while pivot support preserves board position.',
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sourceFromStatus(status?: string): CompetitiveSetSource {
  if (status === 'verified' || status === 'active') return 'v2-verified';
  if (status === 'reviewed') return 'v2-reviewed';
  if (status === 'draft') return 'v2-draft';
  return 'unknown';
}

function findPilotSet(name: string): CompetitiveSetValidationInput | undefined {
  const target = normalize(name);
  return (pilotPack.sets as CompetitiveSetValidationInput[]).find(set => {
    const trusted = set.status === 'reviewed' || set.status === 'verified' || set.status === 'active';
    if (!trusted) return false;
    return normalize(set.pokemonName ?? '') === target ||
      normalize(set.formId ?? '') === target ||
      normalize(set.pokemonId ?? '') === target;
  });
}

function toCompetitiveSet(name: string): CompetitivePokemonSet {
  const record = findPilotSet(name);
  if (!record) return generatedSet(name);
  return {
    name: record.pokemonName ?? name,
    types: [],
    item: record.item ?? 'Sitrus Berry',
    ability: record.ability ?? 'Unknown',
    nature: record.nature ?? 'Serious',
    evs: {
      hp: Number(record.evs?.hp ?? 0),
      atk: Number(record.evs?.atk ?? 0),
      def: Number(record.evs?.def ?? 0),
      spa: Number(record.evs?.spa ?? 0),
      spd: Number(record.evs?.spd ?? 0),
      spe: Number(record.evs?.spe ?? 0),
    },
    ivs: {
      hp: Number(record.ivs?.hp ?? 31),
      atk: Number(record.ivs?.atk ?? 31),
      def: Number(record.ivs?.def ?? 31),
      spa: Number(record.ivs?.spa ?? 31),
      spd: Number(record.ivs?.spd ?? 31),
      spe: Number(record.ivs?.spe ?? 31),
    },
    moves: (record.moves ?? ['Protect', 'Helping Hand', 'Substitute', 'Tera Blast']).slice(0, 4) as [string, string, string, string],
    role: record.primaryRole,
    level: 50,
    setId: record.setId,
    confidence: record.confidence,
    status: record.status,
    sourceType: record.sourceType,
    setSource: sourceFromStatus(record.status),
    validation: { legal: record.legal !== false, errors: [], warnings: [] },
  };
}

function generatedSet(name: string): CompetitivePokemonSet {
  return {
    name,
    types: [],
    item: 'Sitrus Berry',
    ability: 'Unknown',
    nature: 'Serious',
    evs: { hp: 4, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Protect', 'Helping Hand', 'Substitute', 'Tera Blast'],
    level: 50,
    setSource: 'generated',
    validation: { legal: true, errors: [], warnings: [] },
  };
}

function toPokemonData(set: CompetitivePokemonSet): PokemonData {
  return {
    name: set.name,
    types: set.types,
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    role: set.role,
    moves: set.moves,
    competitiveSet: set,
  };
}

function toShowdown(sets: CompetitivePokemonSet[]): string {
  return sets.map(set => [
    `${set.name} @ ${set.item}`,
    `Ability: ${set.ability}`,
    `Level: ${set.level ?? 50}`,
    `${set.nature} Nature`,
    ...set.moves.map(move => `- ${move}`),
  ].join('\n')).join('\n\n');
}

function toPlainText(sets: CompetitivePokemonSet[]): string {
  return sets.map(set => `${set.name}: ${set.item}, ${set.ability}, ${set.nature}, ${set.moves.join(' / ')}`).join('\n');
}

function toJson(sets: CompetitivePokemonSet[]): string {
  return JSON.stringify({ team: sets }, null, 2);
}

function exportMismatchRate(sets: CompetitivePokemonSet[]): number {
  const showdown = toShowdown(sets);
  const text = toPlainText(sets);
  const json = JSON.parse(toJson(sets)) as { team: CompetitivePokemonSet[] };
  let mismatches = 0;
  for (const set of sets) {
    const jsonSet = json.team.find(candidate => candidate.name === set.name);
    const rendered = showdown.includes(`${set.name} @ ${set.item}`) &&
      showdown.includes(`Ability: ${set.ability}`) &&
      text.includes(`${set.name}: ${set.item}, ${set.ability}, ${set.nature}`) &&
      jsonSet?.item === set.item &&
      jsonSet?.ability === set.ability &&
      jsonSet?.nature === set.nature &&
      JSON.stringify(jsonSet?.moves) === JSON.stringify(set.moves);
    if (!rendered) mismatches += 1;
  }
  return Math.round((mismatches / sets.length) * 100);
}

function scenarioComparisons(sets: CompetitivePokemonSet[]): SetSelectionComparison[] {
  const v2Inputs = sets
    .filter(set => set.setSource === 'v2-reviewed' || set.setSource === 'v2-draft' || set.setSource === 'v2-verified')
    .map(set => findPilotSet(set.name))
    .filter((set): set is CompetitiveSetValidationInput => Boolean(set));
  return compareLegacyAndV2Sets({
    legacySets: legacyPack.sets as CompetitiveSetValidationInput[],
    v2Sets: v2Inputs,
  });
}

function calculateRawStrategicScore(comparisons: SetSelectionComparison[], coverage: TeamDataCoverage): number {
  const competitiveAverage = comparisons.length
    ? comparisons.reduce((sum, item) => sum + item.v2Score.competitiveFit, 0) / comparisons.length
    : 50;
  return Math.round(competitiveAverage * 0.7 + coverage.confidenceScore * 0.3);
}

function evaluateScenario(scenario: HomologationScenario): HomologationScenarioResult {
  const sets = scenario.teamSlots.map(toCompetitiveSet);
  const team = sets.map(toPokemonData);
  const coverage = calculateTeamDataCoverage(team);
  const comparisons = scenarioComparisons(sets);
  const rawStrategicScore = calculateRawStrategicScore(comparisons, coverage);
  const dataConfidence = coverage.confidenceScore;
  const confidenceCap = Math.min(coverage.competitiveIndexCap, coverage.verifiedSets < 4 ? 70 : 100);
  const finalCompetitiveScore = Math.min(rawStrategicScore, confidenceCap);
  const v2Preferred = comparisons.filter(item => item.preferred === 'v2').length;
  const manualReview = comparisons.filter(item => item.preferred === 'manual-review').length;
  const roleMismatch = comparisons.filter(item => item.v2Score.roleFit < 80).length;
  const legalityFailure = comparisons.filter(item => item.v2Score.legality < 100).length;
  const coherenceAverage = comparisons.length
    ? Math.round(comparisons.reduce((sum, item) => sum + item.v2Coherence, 0) / comparisons.length)
    : 0;

  return {
    id: scenario.id,
    label: scenario.label,
    lead: scenario.lead,
    setSources: sets.map(set => ({ pokemon: set.name, source: set.setSource, setId: set.setId, role: set.role })),
    comparisons,
    coverage,
    rawStrategicScore,
    dataConfidence,
    confidenceCap,
    finalCompetitiveScore,
    v2PreferenceRate: comparisons.length ? Math.round((v2Preferred / comparisons.length) * 100) : 0,
    manualReviewRate: comparisons.length ? Math.round((manualReview / comparisons.length) * 100) : 0,
    fallbackRate: Math.round((coverage.generatedFallbacks / sets.length) * 100),
    verifiedCoverage: Math.round((coverage.verifiedSets / sets.length) * 100),
    coherenceAverage,
    legalityFailureRate: comparisons.length ? Math.round((legalityFailure / comparisons.length) * 100) : 0,
    roleMismatchRate: comparisons.length ? Math.round((roleMismatch / comparisons.length) * 100) : 0,
    exportMismatchRate: exportMismatchRate(sets),
    quartet: scenario.quartet,
    winCondition: scenario.winCondition,
  };
}

const results = scenarios.map(evaluateScenario);

for (const result of results) {
  const scenario = scenarios.find(item => item.id === result.id)!;
  const v2Count = result.coverage.reviewedSets + result.coverage.verifiedSets;
  assert(v2Count >= scenario.expectedV2Minimum, `${result.label} expected at least ${scenario.expectedV2Minimum} V2 sets.`);
  assert(result.coverage.generatedFallbacks <= scenario.expectedFallbackMaximum, `${result.label} exceeded fallback maximum.`);
  assert(result.legalityFailureRate === 0, `${result.label} has legality failures.`);
  assert(result.roleMismatchRate === 0, `${result.label} has role mismatches.`);
  assert(result.exportMismatchRate === 0, `${result.label} has export mismatches.`);
  assert(result.coverage.verifiedCompetitiveLabel === false, `${result.label} must not receive verified label before verified sets.`);
  if (result.coverage.generatedFallbacks >= 3) {
    assert(result.confidenceCap <= 65, `${result.label} must cap confidence at 65 with three or more fallbacks.`);
  }
  if (result.coverage.verifiedSets < 4) {
    assert(result.dataConfidence <= 70, `${result.label} must cap data confidence at 70 with fewer than four verified sets.`);
  }
}

const aggregate = {
  scenarioCount: results.length,
  v2PreferenceRate: Math.round(results.reduce((sum, item) => sum + item.v2PreferenceRate, 0) / results.length),
  manualReviewRate: Math.round(results.reduce((sum, item) => sum + item.manualReviewRate, 0) / results.length),
  fallbackRate: Math.round(results.reduce((sum, item) => sum + item.fallbackRate, 0) / results.length),
  verifiedCoverage: Math.round(results.reduce((sum, item) => sum + item.verifiedCoverage, 0) / results.length),
  coherenceAverage: Math.round(results.reduce((sum, item) => sum + item.coherenceAverage, 0) / results.length),
  legalityFailureRate: Math.round(results.reduce((sum, item) => sum + item.legalityFailureRate, 0) / results.length),
  roleMismatchRate: Math.round(results.reduce((sum, item) => sum + item.roleMismatchRate, 0) / results.length),
  exportMismatchRate: Math.round(results.reduce((sum, item) => sum + item.exportMismatchRate, 0) / results.length),
};

assert(aggregate.legalityFailureRate === 0, 'Aggregate legality failure rate must be zero.');
assert(aggregate.roleMismatchRate === 0, 'Aggregate role mismatch rate must be zero.');
assert(aggregate.exportMismatchRate === 0, 'Aggregate export mismatch rate must be zero.');

const summaryResults = results.map(result => ({
  id: result.id,
  label: result.label,
  lead: result.lead,
  trustedV2Sets: result.coverage.reviewedSets + result.coverage.verifiedSets,
  draftSets: result.coverage.draftSets,
  generatedFallbacks: result.coverage.generatedFallbacks,
  confidenceScore: result.coverage.confidenceScore,
  competitiveIndexCap: result.coverage.competitiveIndexCap,
  verifiedCompetitiveLabel: result.coverage.verifiedCompetitiveLabel,
  rawStrategicScore: result.rawStrategicScore,
  finalCompetitiveScore: result.finalCompetitiveScore,
  v2PreferenceRate: result.v2PreferenceRate,
  manualReviewRate: result.manualReviewRate,
  fallbackRate: result.fallbackRate,
  legalityFailureRate: result.legalityFailureRate,
  roleMismatchRate: result.roleMismatchRate,
  exportMismatchRate: result.exportMismatchRate,
  quartet: result.quartet,
  winCondition: result.winCondition,
}));

console.log('[Equinox] Shadow homologation validation passed.');
console.log(JSON.stringify({ aggregate, results: summaryResults }, null, 2));
