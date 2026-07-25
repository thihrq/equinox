import { calculateIndependentDamage } from './SmogonCalcDamageReferenceAdapter';
import { calculateIndependentSpeed } from './PokemonShowdownSpeedReferenceAdapter';
import { IndependentDamageFixture, IndependentSpeedFixture } from '../contracts/ReferenceConformanceContracts';

const damageFixture: IndependentDamageFixture = {
  fixtureId: 'reference-damage-neutral-physical-v1', description: 'Canonical neutral physical damage', generation: 9,
  attacker: { species: 'Charizard', level: 50, nature: 'Adamant', evs: { attack: 252 }, ivs: { attack: 31 }, types: ['Fire', 'Flying'] },
  defender: { species: 'Venusaur', level: 50, nature: 'Bold', evs: { hp: 252, defense: 252 }, ivs: { hp: 31, defense: 31 }, types: ['Grass', 'Poison'] },
  move: { name: 'Flare Blitz', type: 'Fire', category: 'Physical', basePower: 120, spread: false },
  field: { doubles: true },
  expected: { calculatedAttackStat: 0, calculatedDefenseStat: 0, defenderHp: 0, rolls: [], minDamage: 0, maxDamage: 0, minPercent: 0, maxPercent: 0, classification: 'unsupported' },
  referenceMethod: 'vendored-reference', sourceReferences: ['@smogon/calc@0.11.0'], calculationSteps: ['construct attacker', 'construct defender', 'calculate gen 9 range'], inputDigest: '', resultDigest: '', fixtureDigest: '',
};

const neutralActor = { species: 'Ditto', level: 50, baseSpeed: 48, nature: 'Serious', speedEv: 0, speedIv: 31, speedStage: 0, move: 'protect', movePriority: 0 };
const speedFixture: IndependentSpeedFixture = {
  fixtureId: 'reference-speed-neutral-v1', description: 'Canonical neutral Speed', generation: 9, formatId: 'champions-reg-mb-doubles',
  actor: { ...neutralActor, nature: 'Timid', speedEv: 252 },
  opponent: neutralActor,
  battleContext: { doubles: true, actorTailwind: false, opponentTailwind: false, trickRoom: false, seed: 'champions-mb-speed-reference-v1' },
  expected: {
    actorCalculatedSpeed: 0, actorEffectiveSpeed: 0, actorPriorityBracket: 0,
    opponentCalculatedSpeed: 0, opponentEffectiveSpeed: 0, opponentPriorityBracket: 0,
    actionOrder: 'unsupported', speedTie: false, trickRoomReversedOrder: false,
  },
  referenceMethod: 'vendored-reference', sourceReferences: ['@pkmn/sim@0.10.11'], calculationSteps: ['construct gen 9 doubles battle', 'switch in actor and opponent', 'read structured Speed and action-order state'],
  assumptions: [], limitations: [], inputDigest: '', resultDigest: '', fixtureDigest: '',
};

const damage = calculateIndependentDamage(damageFixture);
const speed = calculateIndependentSpeed(speedFixture);
if (!damage.supported || damage.rolls.length === 0) throw new Error('Damage reference adapter did not calculate a supported fixture');
if (!speed.supported || !Number.isFinite(speed.actorCalculatedSpeed)) throw new Error('Speed reference adapter did not calculate a supported fixture');
console.log(JSON.stringify({ valid: true, damageRange: [damage.minDamage, damage.maxDamage], speed: speed.actorCalculatedSpeed, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
