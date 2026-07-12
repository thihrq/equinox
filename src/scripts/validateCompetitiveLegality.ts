import { validateCompetitiveSetLegality } from '../equinox/data-validation/CompetitiveSetLegalityValidator';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const illegalMove = validateCompetitiveSetLegality({
  pokemonName: 'Gorebyss',
  pokemonId: 'gorebyss',
  formId: 'gorebyss',
  formatId: 'champions_reg_m_b_doubles',
  regulationId: 'champions_reg_m_b_doubles',
  battleStyle: 'doubles',
  item: 'Sitrus Berry',
  ability: 'Swift Swim',
  nature: 'Modest',
  evs: { hp: 252, spa: 252, spd: 4 },
  ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
  moves: ['Earth Power', 'Muddy Water', 'Ice Beam', 'Protect'],
});

const legalShell = validateCompetitiveSetLegality({
  pokemonName: 'Aggron-Mega',
  pokemonId: 'aggron',
  formId: 'aggronmega',
  formatId: 'champions_reg_m_b_doubles',
  regulationId: 'champions_reg_m_b_doubles',
  battleStyle: 'doubles',
  item: 'Aggronite',
  ability: 'Filter',
  nature: 'Impish',
  evs: { hp: 252, atk: 4, def: 252 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  moves: ['Body Press', 'Heavy Slam', 'Iron Defense', 'Protect'],
  eligibleRoster: [{ pokemonId: 'aggron', forms: ['aggron', 'aggronmega'] }],
});

assert(!illegalMove.legal, 'Illegal moves must fail legality validation.');
assert(illegalMove.errors.some(error => error.code === 'MOVE_NOT_LEARNABLE'), 'Illegal move must be explicit.');
assert(legalShell.legal, `Aggron-Mega shell should be structurally legal: ${legalShell.errors.map(error => error.code).join(', ')}`);

console.log('[Equinox] Competitive set legality validation passed.');
