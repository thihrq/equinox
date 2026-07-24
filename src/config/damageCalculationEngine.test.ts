import { calculateDamage, DamageCalculationInput } from '../services/competitive-data/expert/engines/DamageCalculationEngine';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const baseInput: DamageCalculationInput = {
  attackerPokemonId: 'charizard',
  defenderPokemonId: 'venusaur',
  moveId: 'flamethrower',
  formatId: 'champions-reg-mb-doubles',
  level: 50,
  isSpreadMove: false,
  targetsHit: 1,
  attackerTypes: ['Fire', 'Flying'],
  defenderTypes: ['Grass', 'Poison'],
  attackerStats: { hp: 153, attack: 104, defense: 98, specialAttack: 161, specialDefense: 105, speed: 152 },
  defenderStats: { hp: 187, attack: 100, defense: 103, specialAttack: 120, specialDefense: 120, speed: 100 },
  move: { type: 'Fire', category: 'special', basePower: 90 },
};

const neutral = calculateDamage({ ...baseInput, defenderTypes: ['Normal'] });
assert(neutral.valid, 'neutral damage should be valid');
assert(neutral.damageRolls.length > 1, 'damage should expose random rolls');
assert(neutral.minDamage !== neutral.maxDamage, 'random range should not collapse');

const stab = calculateDamage(baseInput);
assert(stab.maxDamage! > neutral.maxDamage!, 'STAB and super effective damage should increase');

const immune = calculateDamage({ ...baseInput, defenderTypes: ['Ghost'], attackerTypes: ['Normal'], move: { type: 'Normal', category: 'physical', basePower: 80 } });
assert(immune.maxDamage === 0 && immune.possibleOhko === false, 'immunity should produce zero damage');

const spread = calculateDamage({ ...baseInput, defenderTypes: ['Normal'], isSpreadMove: true, targetsHit: 2 });
assert(spread.maxDamage! < neutral.maxDamage!, 'spread modifier should reduce damage');

const rainy = calculateDamage({ ...baseInput, defenderTypes: ['Normal'], weather: 'Rain' });
assert(rainy.maxDamage! < neutral.maxDamage!, 'rain should reduce Fire damage');

const screened = calculateDamage({ ...baseInput, defenderTypes: ['Normal'], screens: { lightScreen: true } });
assert(screened.maxDamage! < neutral.maxDamage!, 'Light Screen should reduce special damage');

// Reference-conformance regression: damage-neutral-physical-charizard-vs-venusaur-v1
// (artifacts/competitive-production-readiness/20260720T033504Z/mechanics-reference/damage-canonical-fixtures.json),
// expected values sourced from @smogon/calc@0.11.0 (see damage-rounding-divergence-analysis.md for the proof).
const referenceFixture = calculateDamage({
  attackerPokemonId: 'charizard',
  defenderPokemonId: 'venusaur',
  moveId: 'flare-blitz',
  formatId: 'champions-reg-mb-doubles',
  level: 50,
  isSpreadMove: false,
  targetsHit: 1,
  attackerTypes: ['Fire', 'Flying'],
  defenderTypes: ['Grass', 'Poison'],
  attackerStats: { hp: 1, attack: 149, defense: 1, specialAttack: 149, specialDefense: 1, speed: 1 },
  defenderStats: { hp: 187, attack: 1, defense: 148, specialAttack: 1, specialDefense: 148, speed: 1 },
  move: { type: 'Fire', category: 'physical', basePower: 120 },
});
assert(referenceFixture.minDamage === 138, `expected minDamage 138 (reference), got ${referenceFixture.minDamage}`);
assert(referenceFixture.maxDamage === 164, `expected maxDamage 164 (reference), got ${referenceFixture.maxDamage}`);

const fixed = calculateDamage({ ...baseInput, move: { type: 'Typeless', category: 'fixed', fixedDamage: 40 } });
assert(fixed.minDamage === 40 && fixed.maxDamage === 40, 'fixed damage should be exact');

const unsupported = calculateDamage({ ...baseInput, terrain: 'Unknown Terrain' });
assert(unsupported.valid === false, 'unsupported terrain should make result incomplete');
assert(unsupported.findings.some(finding => finding.code === 'UNSUPPORTED_MECHANIC'), 'unsupported mechanic finding missing');
assert(unsupported.guaranteedOhko === false, 'incomplete calculation cannot claim guaranteed OHKO');

const repeat = calculateDamage(baseInput);
assert(repeat.resultDigest === stab.resultDigest, 'same input must produce same digest');

console.log('[Equinox] Damage calculation engine tests passed.');
