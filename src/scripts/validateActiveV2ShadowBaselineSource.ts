import {
  CONTROLLED_BASELINE_SOURCE_VERSION,
  computeBaselineSourceDigest,
  readControlledBaselineSource,
} from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowBaselineSource';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const source = readControlledBaselineSource();
const digest = computeBaselineSourceDigest(source.records);

assert(CONTROLLED_BASELINE_SOURCE_VERSION === 'champions-reg-mb-doubles-baseline-v1', 'baseline version must be stable');
assert(source.metadata.baselineSourceVersion === CONTROLLED_BASELINE_SOURCE_VERSION, 'metadata version must match');
assert(source.metadata.baselineSourceRecordCount >= 4, 'baseline must contain at least the four comparison records');
assert(source.metadata.baselineSourceDigest === digest, 'metadata digest must be computed from records');
assert(/^sha256-[a-f0-9]{64}$/.test(source.metadata.baselineSourceDigest), 'digest must be sha256 hex');
assert(source.records.some(record => record.setId === 'sinistcha-bulky-trick-room-setter-draft'), 'baseline must include Sinistcha active set id');

const mutations = [
  ['secondaryRoles', (record: typeof source.records[number]) => ({ ...record, secondaryRoles: [...(record.secondaryRoles ?? []), 'digest-mutation'] })],
  ['archetypes', (record: typeof source.records[number]) => ({ ...record, archetypes: [...(record.archetypes ?? []), 'digest-mutation'] })],
  ['synergyTags', (record: typeof source.records[number]) => ({ ...record, synergyTags: [...(record.synergyTags ?? []), 'digest-mutation'] })],
  ['evs', (record: typeof source.records[number]) => ({ ...record, evs: { ...record.evs, hp: Number(record.evs?.hp ?? 0) + 1 } })],
  ['ivs', (record: typeof source.records[number]) => ({ ...record, ivs: { ...record.ivs, spe: Number(record.ivs?.spe ?? 0) + 1 } })],
  ['confidence', (record: typeof source.records[number]) => ({ ...record, confidence: Number(record.confidence ?? 0) + 1 })],
] as const;

for (const [field, mutate] of mutations) {
  const mutatedRecords = source.records.map((record, index) => index === 0 ? mutate(record) : record);
  assert(computeBaselineSourceDigest(mutatedRecords) !== digest, `${field} mutation must change baseline digest`);
}

const reorderedRecords = [...source.records]
  .reverse()
  .map(record => Object.fromEntries(Object.entries(record).reverse()) as unknown as typeof record);
assert(
  computeBaselineSourceDigest(reorderedRecords) === digest,
  'digest must be stable across record order and object key order',
);
console.log('[Equinox] Active V2 shadow baseline source validation passed.');
