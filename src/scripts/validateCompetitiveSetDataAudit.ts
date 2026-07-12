import setsDataPack from '../equinox/data-packs/sets-data-pack.json';
import {
  auditCompetitiveSetData,
  CompetitiveSetAuditInput,
  toCanonicalPokemonId,
} from '../equinox/competitive/CompetitiveSetDataAuditor';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const sampleSets: CompetitiveSetAuditInput[] = [
  {
    pokemonName: 'Sinistcha',
    formatId: 'champions_reg_m_b_doubles',
    regulationId: 'champions_reg_m_b',
    battleType: 'doubles',
    setName: 'Curated redirection support',
    item: 'Sitrus Berry',
    ability: 'Hospitality',
    nature: 'Bold',
    evs: { hp: 252, def: 156, spd: 100 },
    ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Rage Powder', 'Matcha Gotcha', 'Life Dew', 'Protect'],
    roles: ['redirection_support', 'defensive_glue'],
    archetypes: ['rain_balance'],
    source: { kind: 'curated', name: 'Equinox curated test fixture', updatedAt: '2026-07-12', confidence: 92 },
  },
  {
    pokemonName: 'Togekiss',
    formatId: 'champions_reg_m_b_doubles',
    regulationId: 'champions_reg_m_b',
    battleType: 'doubles',
    setName: 'Incoherent redirection support',
    item: 'Safety Goggles',
    ability: 'Serene Grace',
    nature: 'Timid',
    evs: { hp: 4, spa: 252, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Follow Me', 'Air Slash', 'Helping Hand', 'Protect'],
    role: 'redirection_support',
    synergyTags: ['support'],
    source: { kind: 'observed', name: 'Synthetic regression fixture', updatedAt: '2026-07-12', confidence: 70 },
  },
  {
    pokemonName: 'Togekiss',
    formatId: 'champions_reg_m_b_doubles',
    regulationId: 'champions_reg_m_b',
    battleType: 'doubles',
    setName: 'Duplicate support',
    item: 'Safety Goggles',
    ability: 'Serene Grace',
    nature: 'Timid',
    evs: { hp: 4, spa: 252, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Follow Me', 'Air Slash', 'Helping Hand', 'Protect'],
    role: 'redirection_support',
    source: { kind: 'fallback', name: 'Synthetic fallback fixture', confidence: 30 },
  },
];

const sampleReport = auditCompetitiveSetData(sampleSets, {
  formatId: 'champions_reg_m_b_doubles',
  expectedPokemonIds: ['sinistcha', 'togekiss', 'incineroar'],
});

assert(toCanonicalPokemonId('Aggron-Mega') === 'aggronmega', 'Pokemon IDs must use Showdown-style canonical ids.');
assert(toCanonicalPokemonId('Mega Aggron') === 'aggronmega', 'Mega prefix must normalize to the same canonical form.');
assert(sampleReport.summary.totalSets === 3, 'Sample audit should count all sets.');
assert(sampleReport.summary.duplicateGroups === 1, 'Sample audit should detect duplicate set groups.');
assert(sampleReport.summary.coverageMissing === 1, 'Sample audit should detect expected roster gaps.');
assert(
  sampleReport.coherence.some(issue => issue.code === 'ROLE_SPREAD_MISMATCH' && issue.severity === 'error'),
  'Sample audit should flag offensive spreads assigned to redirection support.',
);
assert(
  sampleReport.legality.every(result => result.setId.length > 0),
  'Every legality result must expose a stable set id.',
);
assert(
  sampleReport.inventory.some(entry => entry.sourceKind === 'fallback' && entry.confidenceBucket === 'low'),
  'Fallback data must be classified as low confidence.',
);

const productionReport = auditCompetitiveSetData(setsDataPack.sets, {
  formatId: 'all',
});

console.log(
  `[Equinox] Competitive set audit: total=${productionReport.summary.totalSets} ` +
    `legalErrors=${productionReport.summary.legalityErrors} coherenceIssues=${productionReport.summary.coherenceIssues} ` +
    `duplicates=${productionReport.summary.duplicateGroups} missingMetadata=${productionReport.summary.missingMetadata}`,
);

for (const action of productionReport.recommendedActions.slice(0, 8)) {
  console.warn(`[Equinox] data action: ${action}`);
}
