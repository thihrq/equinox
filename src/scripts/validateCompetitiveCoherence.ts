import { validateCompetitiveSetCoherence } from '../equinox/data-validation/CompetitiveSetCoherenceValidator';
import { getCompetitiveRole } from '../equinox/competitive/CompetitiveRoleCatalog';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const role = getCompetitiveRole('redirection-support');
const result = validateCompetitiveSetCoherence({
  pokemonName: 'Togekiss',
  pokemonId: 'togekiss',
  formId: 'togekiss',
  formatId: 'champions_reg_m_b_doubles',
  regulationId: 'champions_reg_m_b_doubles',
  battleStyle: 'doubles',
  item: 'Safety Goggles',
  ability: 'Serene Grace',
  nature: 'Timid',
  evs: { hp: 4, spa: 252, spe: 252 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  moves: ['Follow Me', 'Air Slash', 'Helping Hand', 'Protect'],
  primaryRole: 'redirection-support',
  archetypes: ['balance'],
});

assert(Boolean(role), 'Role catalog must expose redirection-support.');
assert(!result.accepted, 'Legal but incoherent support set must be rejected.');
assert(result.coherenceScore < 70, 'Incoherent support set must score below active threshold.');
assert(result.issues.some(issue => issue.code === 'ROLE_SPREAD_MISMATCH'), 'Role/spread mismatch must be explicit.');

console.log('[Equinox] Competitive set coherence validation passed.');
