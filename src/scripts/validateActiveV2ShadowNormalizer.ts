import { normalizeShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowNormalizer';
import type { ActiveV2ShadowPathResult } from '../equinox/competitive/active-v2-shadow/ActiveV2ShadowTypes';

const input = {
  path: 'current',
  sourceMode: 'controlled-baseline',
  enginePath: 'current',
  sourceKind: 'controlled-snapshot',
  inputPokemon: ['Sinistcha', 'Aggron-Mega'],
  format: 'champions-reg-mb-doubles',
  teamIdentity: 'balanced',
  allowLegendaries: false,
  seedState: 'not-applicable',
  setsConsumed: ['b', 'a'],
  movesUsed: ['Protect', 'Rage Powder', 'Protect'],
  itemsUsed: ['Leftovers', 'Sitrus Berry'],
  abilitiesUsed: ['Intimidate', 'Hospitality'],
  roles: ['support', 'breaker'],
  leadStrategies: ['redirect_setup', 'trick_room'],
  score: 0,
  fallbackUsed: false,
  fallbackReason: null,
  exportResult: null,
  errors: [],
  durationMs: 5,
  competitiveVerificationState: 'staging-controlled',
} satisfies ActiveV2ShadowPathResult;

const normalized = normalizeShadowPathResult(input);
if (normalized.setsConsumed.join(',') !== 'a,b') throw new Error('sets must be sorted');
if (normalized.movesUsed.join(',') !== 'Protect,Rage Powder') throw new Error('moves must be deduped and sorted');
console.log('[Equinox] Active V2 shadow normalizer validation passed.');
