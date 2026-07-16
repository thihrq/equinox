import mongoose from 'mongoose';
import { appConfig } from '../config/env';
import legacyPack from '../equinox/data-packs/sets-data-pack.json';
import fixturePack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { compareLegacyAndV2Sets, SetSelectionComparison } from '../equinox/competitive/CompetitiveSetShadowComparator';
import { CompetitivePokemonSet, CompetitiveSetSource } from '../equinox/competitive/CompetitivePokemonSet';
import { calculateTeamDataCoverage, TeamDataCoverage } from '../equinox/competitive/TeamDataCoverage';
import { assertMongoAccessAllowed, buildAuditRuntimeReport, markMongoConnected, markMongoRead, printAuditRuntimeReport } from '../equinox/data-audit/DataAuditRuntime';
import { CompetitiveSetValidationInput, CompetitiveSetStatus } from '../equinox/data-validation/CompetitiveValidationTypes';

interface HomologationScenario {
  id: string;
  label: string;
  teamSlots: string[];
  expectedV2Minimum: number;
  expectedFallbackMaximum: number;
}

interface HomologationResult {
  id: string;
  label: string;
  coverage: TeamDataCoverage;
  comparisons: SetSelectionComparison[];
  v2PreferenceRate: number;
  roleMismatchRate: number;
  legalityFailureRate: number;
  exportMismatchRate: number;
}

type StatusCounts = Record<CompetitiveSetStatus, number>;

const TARGET_COLLECTION = 'pokemonsets_v2_staging';
const REGULATION_ID = 'champions_reg_m_b_doubles';
const args = new Set(process.argv.slice(2));
const useFixture = args.has('--fixture');

const scenarios: HomologationScenario[] = [
  {
    id: 'sinistcha-aggron-trick-room',
    label: 'Sinistcha + Aggron-Mega',
    teamSlots: ['Sinistcha', 'Aggron-Mega', 'Ursaluna-Bloodmoon', 'Incineroar', 'Togekiss', 'Muk-Alola'],
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'indeedee-hatterene-psychic-room',
    label: 'Indeedee-F + Hatterene',
    teamSlots: ['Indeedee-F', 'Hatterene', 'Sinistcha', 'Ursaluna-Bloodmoon', 'Incineroar', 'Togekiss'],
    expectedV2Minimum: 3,
    expectedFallbackMaximum: 3,
  },
  {
    id: 'pelipper-basculegion-rain',
    label: 'Pelipper + Basculegion',
    teamSlots: ['Pelipper', 'Basculegion', 'Incineroar', 'Sinistcha', 'Ursaluna-Bloodmoon', 'Muk-Alola'],
    expectedV2Minimum: 3,
    expectedFallbackMaximum: 3,
  },
  {
    id: 'torkoal-lilligant-sun',
    label: 'Torkoal + Lilligant',
    teamSlots: ['Torkoal', 'Lilligant', 'Ursaluna-Bloodmoon', 'Incineroar', 'Sinistcha', 'Aggron-Mega'],
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'rillaboom-physical-attacker',
    label: 'Rillaboom + physical attacker',
    teamSlots: ['Rillaboom', 'Aggron-Mega', 'Incineroar', 'Sinistcha', 'Ursaluna-Bloodmoon', 'Togekiss'],
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'fast-tailwind-lead',
    label: 'Fast Tailwind lead',
    teamSlots: ['Tornadus', 'Incineroar', 'Ursaluna-Bloodmoon', 'Sinistcha', 'Aggron-Mega', 'Muk-Alola'],
    expectedV2Minimum: 4,
    expectedFallbackMaximum: 2,
  },
  {
    id: 'defensive-redirection-lead',
    label: 'Defensive redirection lead',
    teamSlots: ['Sinistcha', 'Ursaluna-Bloodmoon', 'Incineroar', 'Aggron-Mega', 'Togekiss', 'Muk-Alola'],
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

function statusCounts(records: CompetitiveSetValidationInput[]): StatusCounts {
  return records.reduce<StatusCounts>((counts, record) => {
    const status = record.status ?? 'draft';
    counts[status] += 1;
    return counts;
  }, { active: 0, verified: 0, reviewed: 0, deprecated: 0, quarantined: 0, draft: 0 });
}

function sourceFromStatus(status?: string): CompetitiveSetSource {
  if (status === 'verified' || status === 'active') return 'v2-verified';
  if (status === 'reviewed') return 'v2-reviewed';
  if (status === 'draft') return 'v2-draft';
  return 'unknown';
}

function toValidationInput(record: Record<string, unknown>): CompetitiveSetValidationInput {
  return {
    pokemonName: String(record.pokemonName ?? ''),
    pokemonId: typeof record.pokemonId === 'string' ? record.pokemonId : undefined,
    formId: typeof record.formId === 'string' ? record.formId : undefined,
    formatId: typeof record.formatId === 'string' ? record.formatId : undefined,
    regulationId: typeof record.regulationId === 'string' ? record.regulationId : undefined,
    battleStyle: record.battleStyle === 'singles' || record.battleStyle === 'doubles' ? record.battleStyle : undefined,
    setId: typeof record.setId === 'string' ? record.setId : undefined,
    setName: typeof record.setName === 'string' ? record.setName : undefined,
    item: typeof record.item === 'string' ? record.item : undefined,
    ability: typeof record.ability === 'string' ? record.ability : undefined,
    nature: typeof record.nature === 'string' ? record.nature : undefined,
    evs: record.evs as CompetitiveSetValidationInput['evs'],
    ivs: record.ivs as CompetitiveSetValidationInput['ivs'],
    moves: Array.isArray(record.moves) ? record.moves.map(String) : undefined,
    primaryRole: typeof record.primaryRole === 'string' ? record.primaryRole : undefined,
    secondaryRoles: Array.isArray(record.secondaryRoles) ? record.secondaryRoles.map(String) : undefined,
    archetypes: Array.isArray(record.archetypes) ? record.archetypes.map(String) : undefined,
    synergyTags: Array.isArray(record.synergyTags) ? record.synergyTags.map(String) : undefined,
    sourceId: typeof record.sourceId === 'string' ? record.sourceId : undefined,
    sourceType: typeof record.sourceType === 'string' ? record.sourceType : undefined,
    confidence: typeof record.confidence === 'number' ? record.confidence : undefined,
    legal: typeof record.legal === 'boolean' ? record.legal : undefined,
    status: record.status as CompetitiveSetStatus | undefined,
    coherenceScore: typeof record.coherenceScore === 'number' ? record.coherenceScore : undefined,
    dataVersion: typeof record.dataVersion === 'string' ? record.dataVersion : undefined,
    contentHash: typeof record.contentHash === 'string' ? record.contentHash : undefined,
  };
}

function findSet(records: CompetitiveSetValidationInput[], name: string): CompetitiveSetValidationInput | undefined {
  const target = normalize(name);
  return records.find(set => {
    if (set.status !== 'reviewed' && set.status !== 'verified' && set.status !== 'active') return false;
    return normalize(set.pokemonName ?? '') === target ||
      normalize(set.formId ?? '') === target ||
      normalize(set.pokemonId ?? '') === target;
  });
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

function toCompetitiveSet(records: CompetitiveSetValidationInput[], name: string): CompetitivePokemonSet {
  const record = findSet(records, name);
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

function exportMismatchRate(sets: CompetitivePokemonSet[]): number {
  const showdown = sets.map(set => `${set.name} @ ${set.item}\nAbility: ${set.ability}\n${set.nature} Nature\n${set.moves.map(move => `- ${move}`).join('\n')}`).join('\n\n');
  const json = JSON.parse(JSON.stringify({ team: sets })) as { team: CompetitivePokemonSet[] };
  const mismatches = sets.filter(set => {
    const jsonSet = json.team.find(candidate => candidate.name === set.name);
    return !showdown.includes(`${set.name} @ ${set.item}`) ||
      !showdown.includes(`Ability: ${set.ability}`) ||
      jsonSet?.item !== set.item ||
      jsonSet?.ability !== set.ability ||
      JSON.stringify(jsonSet?.moves) !== JSON.stringify(set.moves);
  }).length;
  return Math.round((mismatches / sets.length) * 100);
}

function evaluateScenario(records: CompetitiveSetValidationInput[], scenario: HomologationScenario): HomologationResult {
  const sets = scenario.teamSlots.map(name => toCompetitiveSet(records, name));
  const coverage = calculateTeamDataCoverage(sets.map(set => ({
    name: set.name,
    types: set.types,
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    role: set.role,
    moves: set.moves,
    competitiveSet: set,
  })));
  const v2Inputs = sets
    .filter(set => set.setSource === 'v2-reviewed' || set.setSource === 'v2-verified' || set.setSource === 'v2-draft')
    .map(set => records.find(record => record.setId === set.setId))
    .filter((set): set is CompetitiveSetValidationInput => Boolean(set));
  const comparisons = compareLegacyAndV2Sets({
    legacySets: legacyPack.sets as CompetitiveSetValidationInput[],
    v2Sets: v2Inputs,
  });
  const roleMismatches = comparisons.filter(item => item.v2Score.roleFit < 80).length;
  const legalityFailures = comparisons.filter(item => item.v2Score.legality < 100).length;
  const v2Preferred = comparisons.filter(item => item.preferred === 'v2').length;

  return {
    id: scenario.id,
    label: scenario.label,
    coverage,
    comparisons,
    v2PreferenceRate: comparisons.length ? Math.round((v2Preferred / comparisons.length) * 100) : 0,
    roleMismatchRate: comparisons.length ? Math.round((roleMismatches / comparisons.length) * 100) : 0,
    legalityFailureRate: comparisons.length ? Math.round((legalityFailures / comparisons.length) * 100) : 0,
    exportMismatchRate: exportMismatchRate(sets),
  };
}

function validatePackage(records: CompetitiveSetValidationInput[]): void {
  const counts = statusCounts(records);
  assert(records.length === 14, `Staging collection must contain 14 records, received ${records.length}.`);
  assert(counts.reviewed === 14, `Staging collection must contain 14 reviewed records, received ${counts.reviewed}.`);
  assert(counts.draft === 0, `Staging collection must contain 0 draft records, received ${counts.draft}.`);
  assert(counts.quarantined === 0, `Staging collection must contain 0 quarantined records, received ${counts.quarantined}.`);
  assert(counts.deprecated === 0, `Staging collection must contain 0 deprecated records, received ${counts.deprecated}.`);
  assert(counts.verified === 0, `Staging collection must contain 0 verified records, received ${counts.verified}.`);
  assert(counts.active === 0, `Staging collection must contain 0 active records, received ${counts.active}.`);
  assert(records.every(record => record.regulationId === REGULATION_ID), `All staging records must use regulationId=${REGULATION_ID}.`);
  assert(records.every(record => record.battleStyle === 'doubles'), 'All staging records must use doubles battleStyle.');
  assert(records.every(record => record.legal !== false), 'Staging records must not contain explicit illegal sets.');
}

function validateScenarios(records: CompetitiveSetValidationInput[]): HomologationResult[] {
  const results = scenarios.map(scenario => evaluateScenario(records, scenario));
  for (const result of results) {
    const scenario = scenarios.find(item => item.id === result.id)!;
    const v2Count = result.coverage.reviewedSets + result.coverage.verifiedSets;
    assert(v2Count >= scenario.expectedV2Minimum, `${result.label} expected at least ${scenario.expectedV2Minimum} V2 sets.`);
    assert(result.coverage.generatedFallbacks <= scenario.expectedFallbackMaximum, `${result.label} exceeded fallback maximum.`);
    assert(result.coverage.draftSets === 0, `${result.label} must not consume draft sets.`);
    assert(result.coverage.verifiedCompetitiveLabel === false, `${result.label} must not receive verified label from reviewed-only staging data.`);
    assert(result.legalityFailureRate === 0, `${result.label} has legality failures.`);
    assert(result.roleMismatchRate === 0, `${result.label} has role mismatches.`);
    assert(result.exportMismatchRate === 0, `${result.label} has export mismatches.`);
  }
  return results;
}

async function loadRecords(): Promise<CompetitiveSetValidationInput[]> {
  if (useFixture) {
    return (fixturePack as { sets: CompetitiveSetValidationInput[] }).sets;
  }

  assert(process.env.EQUINOX_TARGET_COLLECTION === TARGET_COLLECTION, `Set EQUINOX_TARGET_COLLECTION=${TARGET_COLLECTION} before staging homologation.`);
  assert(appConfig.allowDatabaseWrites === false, 'Staging homologation is read-only: EQUINOX_ALLOW_DATABASE_WRITES must be false.');
  assertMongoAccessAllowed('read staging competitive sets');

  await mongoose.connect(appConfig.mongoUri);
  markMongoConnected();
  const rawRecords = await mongoose.connection.collection(TARGET_COLLECTION).find({}).toArray();
  markMongoRead(rawRecords.length);
  return rawRecords.map(record => toValidationInput(record as Record<string, unknown>));
}

async function main(): Promise<void> {
  try {
    const records = await loadRecords();
    validatePackage(records);
    const results = validateScenarios(records);
    const counts = statusCounts(records);
    const aggregate = {
      scenarioCount: results.length,
      v2PreferenceRate: Math.round(results.reduce((sum, result) => sum + result.v2PreferenceRate, 0) / results.length),
      fallbackRate: Math.round(results.reduce((sum, result) => sum + result.coverage.generatedFallbacks, 0) / (results.length * 6) * 100),
      roleMismatchRate: Math.round(results.reduce((sum, result) => sum + result.roleMismatchRate, 0) / results.length),
      legalityFailureRate: Math.round(results.reduce((sum, result) => sum + result.legalityFailureRate, 0) / results.length),
      exportMismatchRate: Math.round(results.reduce((sum, result) => sum + result.exportMismatchRate, 0) / results.length),
    };

    console.log('[Equinox] Staging homologation validation passed.');
    console.log(JSON.stringify({
      source: useFixture ? 'fixture' : TARGET_COLLECTION,
      records: records.length,
      statusCounts: counts,
      aggregate,
      results: results.map(result => ({
        id: result.id,
        label: result.label,
        trustedV2Sets: result.coverage.reviewedSets + result.coverage.verifiedSets,
        draftSets: result.coverage.draftSets,
        generatedFallbacks: result.coverage.generatedFallbacks,
        confidenceScore: result.coverage.confidenceScore,
        verifiedCompetitiveLabel: result.coverage.verifiedCompetitiveLabel,
        v2PreferenceRate: result.v2PreferenceRate,
      })),
    }, null, 2));

    printAuditRuntimeReport(buildAuditRuntimeReport([
      {
        type: useFixture ? 'file' : 'mongo',
        label: useFixture ? 'local staging homologation fixture' : TARGET_COLLECTION,
        recordCount: records.length,
      },
    ]));
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
