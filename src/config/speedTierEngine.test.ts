import { calculateSpeedTier, compareActionOrder } from '../services/competitive-data/expert/engines/SpeedTierEngine';
import { SpeedTierInput } from '../services/competitive-data/expert/engines/SpeedTierTypes';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const baseInput: SpeedTierInput = {
  pokemonId: 'charizard',
  baseSpeed: 100,
  level: 50,
  speedEv: 252,
  speedIv: 31,
  natureId: 'Timid',
  statStage: 0,
  tailwind: false,
  trickRoom: false,
  weather: undefined,
};

const neutral = calculateSpeedTier({ ...baseInput, natureId: 'Serious' });
const positive = calculateSpeedTier(baseInput);
const negative = calculateSpeedTier({ ...baseInput, natureId: 'Brave' });
assert(positive.modifiedSpeed! > neutral.modifiedSpeed!, 'positive nature should increase Speed');
assert(negative.modifiedSpeed! < neutral.modifiedSpeed!, 'negative nature should reduce Speed');

const zeroIv = calculateSpeedTier({ ...baseInput, speedIv: 0, speedEv: 0 });
assert(zeroIv.modifiedSpeed! < neutral.modifiedSpeed!, 'zero IV and EV should reduce Speed');

const scarf = calculateSpeedTier({ ...baseInput, itemId: 'Choice Scarf' });
assert(scarf.modifiedSpeed! > positive.modifiedSpeed!, 'Choice Scarf should increase Speed');

const wind = calculateSpeedTier({ ...baseInput, tailwind: true });
assert(wind.modifiedSpeed! === positive.modifiedSpeed! * 2, 'Tailwind should double Speed');

const swiftSwim = calculateSpeedTier({ ...baseInput, abilityId: 'Swift Swim', weather: 'Rain' });
assert(swiftSwim.modifiedSpeed! === positive.modifiedSpeed! * 2, 'Swift Swim should double Speed in Rain');

const trickRoom = calculateSpeedTier({ ...baseInput, trickRoom: true });
assert(trickRoom.rawSpeed === positive.rawSpeed, 'Trick Room must not change calculated Speed');
assert(trickRoom.trickRoomOrderValue! < 0, 'Trick Room must invert order value');

assert(compareActionOrder({ speed: 50, priority: 1 }, { speed: 200, priority: 0 }, false) === 'first', 'higher priority must act first');
assert(compareActionOrder({ speed: 100, priority: 0 }, { speed: 100, priority: 0 }, false) === 'tie', 'equal Speed should tie');
assert(compareActionOrder({ speed: 100, priority: 0 }, { speed: 120, priority: 0 }, true) === 'first', 'slower Speed should act first in Trick Room');

const unsupported = calculateSpeedTier({ ...baseInput, abilityId: 'Unverified Ability' });
assert(!unsupported.valid, 'unsupported ability should make result incomplete');
assert(unsupported.findings.some(finding => finding.code === 'UNSUPPORTED_MECHANIC'), 'unsupported Speed finding missing');
const repeat = calculateSpeedTier(baseInput);
assert(repeat.resultDigest === positive.resultDigest, 'same Speed input must generate same digest');

// Reference-conformance regression: the actor's own move priority must be reflected in
// priorityBracket -- previously hardcoded to 0 regardless of input, which made it impossible
// to express "this Pokemon's own move has priority +1" (see damage-rounding-divergence-analysis
// sibling investigation, Wave 1B Priority 3, Speed Reference Contract).
const defaultPriority = calculateSpeedTier(baseInput);
assert(defaultPriority.priorityBracket === 0, 'default movePriority should be 0');
const boostedPriority = calculateSpeedTier({ ...baseInput, movePriority: 1 });
assert(boostedPriority.priorityBracket === 1, "priorityBracket should reflect the actor's own move priority");
const negativePriority = calculateSpeedTier({ ...baseInput, movePriority: -1 });
assert(negativePriority.priorityBracket === -1, 'negative movePriority should be reflected as-is');

// Reference-conformance regression: SpeedTierResult had no field representing "calculated Speed"
// (stage-boosted, modifier-excluded) as its own concept -- only rawSpeed (pre-stage) and
// modifiedSpeed (post-everything) were exposed, conflating the four-concept Speed model the
// Wave 1B Speed Reference Contract requires (see mechanics-reference/speed-reference-methodology.md).
const stagePlusOne = calculateSpeedTier({ ...baseInput, statStage: 1 });
assert(stagePlusOne.calculatedSpeed === Math.floor(stagePlusOne.rawSpeed! * 1.5), 'calculatedSpeed must reflect the stage boost that modifiedSpeed already reflects');
assert(stagePlusOne.calculatedSpeed !== stagePlusOne.rawSpeed, 'calculatedSpeed must differ from rawSpeed when a stage boost is applied');

// Reference-conformance regression: item/ability/weather matching used hardcoded, inconsistent
// display-name strings ('choice scarf', 'sand rush', 'sun') instead of showdown/@pkmn id form
// ('choicescarf', 'sandrush', 'sunnyday'), so the same real mechanic reported as unsupported or
// inert depending on formatting alone.
const scarfById = calculateSpeedTier({ ...baseInput, itemId: 'choicescarf' });
assert(scarfById.modifiedSpeed === Math.floor(scarfById.calculatedSpeed! * 1.5), 'Choice Scarf must be recognized by its id form (choicescarf), not only the display string');
const sandRushById = calculateSpeedTier({ ...baseInput, abilityId: 'sandrush', weather: 'sandstorm' });
assert(sandRushById.modifiedSpeed === sandRushById.calculatedSpeed! * 2, 'Sand Rush must be recognized by its id form (sandrush)');
const swiftSwimInRealWeatherId = calculateSpeedTier({ ...baseInput, abilityId: 'swiftswim', weather: 'raindance' });
assert(swiftSwimInRealWeatherId.modifiedSpeed === swiftSwimInRealWeatherId.calculatedSpeed! * 2, 'Swift Swim must recognize the real @pkmn/sim weather id (raindance), not just the display word (rain)');

console.log('[Equinox] Speed tier engine tests passed.');
