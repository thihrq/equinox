import legacyPack from '../equinox/data-packs/sets-data-pack.json';
import pilotPack from '../equinox/data-packs/competitive/champions-reg-mb-doubles/sets.json';
import { createAuditRunContext } from '../equinox/data-audit/AuditRunContext';
import { printAuditHeader } from '../equinox/data-audit/AuditLogger';
import { compareLegacyAndV2Sets } from '../equinox/competitive/CompetitiveSetShadowComparator';
import { CompetitiveSetValidationInput } from '../equinox/data-validation/CompetitiveValidationTypes';

const context = createAuditRunContext('sets:shadow:compare');
const comparisons = compareLegacyAndV2Sets({
  legacySets: legacyPack.sets as CompetitiveSetValidationInput[],
  v2Sets: pilotPack.sets as CompetitiveSetValidationInput[],
});
const governanceOnlyControl = compareLegacyAndV2Sets({
  legacySets: [{
    pokemonId: 'controlmon',
    pokemonName: 'Controlmon',
    setId: 'legacy-competitive-fit-control',
    primaryRole: 'slow-physical-breaker',
    item: 'Life Orb',
    ability: 'Pressure',
    nature: 'Brave',
    evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 0 },
    moves: ['Rock Slide', 'Stomping Tantrum', 'Heavy Slam', 'Protect'],
    legal: true,
    coherenceScore: 88,
  }],
  v2Sets: [{
    pokemonId: 'controlmon',
    pokemonName: 'Controlmon',
    setId: 'v2-metadata-only-control',
    primaryRole: 'slow-physical-breaker',
    item: 'Sitrus Berry',
    ability: 'Pressure',
    nature: 'Jolly',
    evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ['Rock Slide', 'Protect', 'Taunt', 'Substitute'],
    regulationId: 'champions_reg_m_b_doubles',
    battleStyle: 'doubles',
    sourceId: 'equinox-control',
    sourceUpdatedAt: '2026-07-12',
    confidence: 95,
    status: 'draft',
    dataVersion: '2026.07.1',
    legal: true,
    coherenceScore: 72,
  }],
})[0];

if (governanceOnlyControl.preferred !== 'manual-review') {
  throw new Error(`Shadow comparator control failed: expected manual-review, received ${governanceOnlyControl.preferred}.`);
}

printAuditHeader({
  context,
  readCount: legacyPack.sets.length + pilotPack.sets.length,
  writtenCount: 0,
});
console.log(JSON.stringify({
  runId: context.runId,
  comparisons,
  governanceOnlyControl,
  mongoWrites: 0,
}, null, 2));
