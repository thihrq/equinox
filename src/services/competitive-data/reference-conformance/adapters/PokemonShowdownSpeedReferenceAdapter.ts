import { Battle, toID } from '@pkmn/sim';
import { IndependentSpeedActor, IndependentSpeedFixture, SpeedActionOrder, stableDigest } from '../contracts/ReferenceConformanceContracts';

export interface IndependentSpeedReferenceResult {
  fixtureId: string;
  supported: boolean;
  unsupportedReasons: string[];
  actorCalculatedSpeed: number;
  actorEffectiveSpeed: number;
  actorPriorityBracket: number;
  opponentCalculatedSpeed: number;
  opponentEffectiveSpeed: number;
  opponentPriorityBracket: number;
  actionOrder: SpeedActionOrder;
  speedTie: boolean;
  trickRoomReversedOrder: boolean;
  referencePackage: '@pkmn/sim';
  referenceVersion: '0.10.11';
  inputDigest: string;
  resultDigest: string;
}

// Neutral doubles-format filler so both active slots are filled without introducing
// a second scored combatant (side/field-wide event resolution in @pkmn/sim requires
// both active slots to hold a real Pokemon).
const FILLER_SPECIES = 'Wynaut';

function fillerTeamMember(): AnyTeamMember {
  return {
    name: FILLER_SPECIES, species: FILLER_SPECIES, moves: ['protect'], ability: '', item: '', nature: 'Serious',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50, gender: 'M' as const,
  };
}

type AnyTeamMember = {
  name: string; species: string; moves: string[]; ability: string; item: string; nature: string;
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  level: number; gender: 'M';
};

function buildTeamMember(actor: IndependentSpeedActor): AnyTeamMember {
  return {
    name: actor.species, species: actor.species, moves: [actor.move], ability: actor.ability ?? '', item: actor.item ?? '', nature: actor.nature,
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: actor.speedEv }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: actor.speedIv },
    level: actor.level, gender: 'M' as const,
  };
}

interface ActorProfile { calculatedSpeed: number; effectiveSpeed: number; priorityBracket: number; actionSpeed: number }

function computeActorProfile(
  battle: Battle,
  pokemon: Battle['p1']['pokemon'][number],
  opponentPokemon: Battle['p1']['pokemon'][number],
  actorInput: IndependentSpeedActor,
  expectedBaseSpeed: number,
  unsupportedReasons: string[],
  prefix: string,
): ActorProfile {
  const dexSpecies = battle.dex.species.get(actorInput.species);
  if (!dexSpecies.exists) unsupportedReasons.push(`${prefix}:species-not-found:${actorInput.species}`);
  else if (dexSpecies.baseStats.spe !== expectedBaseSpeed) {
    unsupportedReasons.push(`${prefix}:base-speed-mismatch:fixture=${expectedBaseSpeed}:dex=${dexSpecies.baseStats.spe}`);
  }
  if (actorInput.item) {
    const dexItem = battle.dex.items.get(actorInput.item);
    if (!dexItem.exists) unsupportedReasons.push(`${prefix}:item-not-found:${actorInput.item}`);
  }
  if (actorInput.ability) {
    const dexAbility = battle.dex.abilities.get(actorInput.ability);
    if (!dexAbility.exists) unsupportedReasons.push(`${prefix}:ability-not-found:${actorInput.ability}`);
  }
  if (actorInput.status) {
    const applied = pokemon.setStatus(toID(actorInput.status), null, null, true);
    if (!applied) unsupportedReasons.push(`${prefix}:status-not-applicable:${actorInput.status}`);
  }
  if (actorInput.speedStage !== 0) pokemon.boosts.spe = Math.max(-6, Math.min(6, actorInput.speedStage));
  const calculatedSpeed = pokemon.getStat('spe', false, true);
  const effectiveSpeed = pokemon.getStat('spe', false, false);
  const move = battle.dex.moves.get(actorInput.move);
  if (!move.exists) unsupportedReasons.push(`${prefix}:move-not-found:${actorInput.move}`);
  // Matches the ability-based half of the real engine's turn-order-priority resolution
  // (Battle.prototype.runAction in @pkmn/sim's battle.js calls this same runEvent), so
  // ability-based priority modifiers (Prankster, Gale Wings, ...) resolve through the actual
  // event pipeline. Not covered here: the move-intrinsic singleEvent('ModifyPriority', move, ...)
  // step the real engine also runs (e.g. Grassy Glide's terrain-conditional priority) -- no
  // fixture in this set exercises a move with its own conditional priority, so this is a real,
  // narrow gap versus 100% turn-order fidelity, not something this adapter currently claims to cover.
  // `battle.dex.moves.get()` and `runEvent`'s `sourceEffect` parameter resolve to structurally
  // identical but nominally distinct `Move`/`Effect` declarations across @pkmn/sim's generated
  // type files; the real engine passes a dex Move here too (battle.js runAction), so this cast
  // is a known cross-module typing gap, not an unchecked `any`.
  const modifiedPriority = battle.runEvent('ModifyPriority', pokemon, opponentPokemon, move as unknown as Parameters<Battle['runEvent']>[3], actorInput.movePriority);
  const priorityBracket = typeof modifiedPriority === 'number' ? modifiedPriority : actorInput.movePriority;
  const actionSpeed = pokemon.getActionSpeed();
  return { calculatedSpeed, effectiveSpeed, priorityBracket, actionSpeed };
}

export function calculateIndependentSpeed(fixture: IndependentSpeedFixture): IndependentSpeedReferenceResult {
  const unsupportedReasons: string[] = [];
  const actorTeam = [buildTeamMember(fixture.actor), fillerTeamMember()];
  const opponentTeam = [buildTeamMember(fixture.opponent), fillerTeamMember()];
  const battle = new Battle({
    formatid: toID('gen9vgc2024regg'),
    p1: { name: 'actor', team: actorTeam },
    p2: { name: 'opponent', team: opponentTeam },
  });
  battle.actions.switchIn(battle.p1.pokemon[0], 0);
  battle.actions.switchIn(battle.p1.pokemon[1], 1);
  battle.actions.switchIn(battle.p2.pokemon[0], 0);
  battle.actions.switchIn(battle.p2.pokemon[1], 1);
  const actorPokemon = battle.p1.pokemon[0];
  const opponentPokemon = battle.p2.pokemon[0];

  if (fixture.battleContext.weather) {
    const applied = battle.field.setWeather(toID(fixture.battleContext.weather), actorPokemon);
    if (applied === false) unsupportedReasons.push(`weather-not-applicable:${fixture.battleContext.weather}`);
  }
  if (fixture.battleContext.terrain) {
    const applied = battle.field.setTerrain(toID(fixture.battleContext.terrain), actorPokemon);
    if (applied === false) unsupportedReasons.push(`terrain-not-applicable:${fixture.battleContext.terrain}`);
  }
  if (fixture.battleContext.actorTailwind) battle.p1.addSideCondition('tailwind', actorPokemon);
  if (fixture.battleContext.opponentTailwind) battle.p2.addSideCondition('tailwind', opponentPokemon);
  if (fixture.battleContext.trickRoom) battle.field.addPseudoWeather('trickroom', actorPokemon);

  const actor = computeActorProfile(battle, actorPokemon, opponentPokemon, fixture.actor, fixture.actor.baseSpeed, unsupportedReasons, 'actor');
  const opponent = computeActorProfile(battle, opponentPokemon, actorPokemon, fixture.opponent, fixture.opponent.baseSpeed, unsupportedReasons, 'opponent');

  // Real production comparator (Battle.prototype.comparePriority), not a reimplementation --
  // this is the exact function the simulator itself uses to order queued actions.
  const comparison = battle.comparePriority(
    { priority: actor.priorityBracket, speed: actor.actionSpeed },
    { priority: opponent.priorityBracket, speed: opponent.actionSpeed },
  );

  let actionOrder: SpeedActionOrder;
  let speedTie = false;
  if (actor.priorityBracket !== opponent.priorityBracket) {
    actionOrder = comparison < 0 ? 'priority-actor-first' : 'priority-opponent-first';
  } else if (comparison === 0) {
    actionOrder = 'speed-tie';
    speedTie = true;
  } else if (fixture.battleContext.trickRoom) {
    actionOrder = comparison < 0 ? 'trick-room-actor-first' : 'trick-room-opponent-first';
  } else {
    actionOrder = comparison < 0 ? 'actor-first' : 'opponent-first';
  }

  let trickRoomReversedOrder = false;
  if (fixture.battleContext.trickRoom && actor.priorityBracket === opponent.priorityBracket && actor.effectiveSpeed !== opponent.effectiveSpeed) {
    const normallyActorFirst = actor.effectiveSpeed > opponent.effectiveSpeed;
    const actuallyActorFirst = comparison < 0;
    trickRoomReversedOrder = normallyActorFirst !== actuallyActorFirst;
  }

  const output = {
    fixtureId: fixture.fixtureId,
    supported: unsupportedReasons.length === 0,
    unsupportedReasons,
    actorCalculatedSpeed: actor.calculatedSpeed,
    actorEffectiveSpeed: actor.effectiveSpeed,
    actorPriorityBracket: actor.priorityBracket,
    opponentCalculatedSpeed: opponent.calculatedSpeed,
    opponentEffectiveSpeed: opponent.effectiveSpeed,
    opponentPriorityBracket: opponent.priorityBracket,
    actionOrder: unsupportedReasons.length > 0 ? ('unsupported' as const) : actionOrder,
    speedTie,
    trickRoomReversedOrder,
    referencePackage: '@pkmn/sim' as const,
    referenceVersion: '0.10.11' as const,
    inputDigest: stableDigest(fixture),
  };
  return { ...output, resultDigest: stableDigest(output) };
}
