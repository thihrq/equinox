process.env.EQUINOX_DATA_MODE = 'mongo';
process.env.EQUINOX_WEAKNESS_PENALTY_WEIGHT = '0.6';

import dotenv from 'dotenv';
dotenv.config();

import { connectIsolatedTestDatabase, IsolatedTestDatabase } from './testing/IsolatedTestDatabase';
import { LeadStrategyRecommendationService } from '../../services/LeadStrategyRecommendationService';
import { Pokemon } from '../../models/Pokemon';
import { PokemonSet } from '../../models/PokemonSet';

const FORMAT = 'champions_reg_m_b_doubles';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

function mon(dexNumber: number, name: string, types: string[], baseStats: any) {
  return {
    dexNumber, name, formatId: FORMAT, types,
    variants: [{ formatId: FORMAT, baseStats, types, abilities: { 0: 'Pressure' } }],
    isLegendary: false, usageScore: 90, formatLegality: { [FORMAT]: true },
  };
}

function set(pokemonName: string, item: string, ability: string, nature: string, evs: any, moves: string[], role = 'attacker') {
  return {
    pokemonName, formatId: FORMAT, setName: `${pokemonName} test`, item, ability, nature, evs,
    moves, role, synergyTags: [], legal: true, status: 'active', active: true, confidence: 80,
  };
}

/**
 * Reproduz os 5 arquétipos do Build-Around-Lead já validados nesta sessão
 * (sun_offense, tailwind_rush, defensive_core, trick_room, rain_offense —
 * gerados por LeadStrategyGenerator.ts, não confundir com o arquétipo
 * `hard_trick_room` do fluxo geral de Team Builder, que é outro sistema).
 * Com EQUINOX_WEAKNESS_PENALTY_WEIGHT=0.6 ligado, cada lead precisa
 * continuar aceitando pelo menos 1 estratégia.
 */
async function testSunTailwindDefensiveCore(db: IsolatedTestDatabase): Promise<void> {
  await Pokemon.create([
    mon(6, 'Charizard-Mega-Y', ['Fire', 'Flying'], { hp: 78, atk: 104, def: 78, spa: 159, spd: 115, spe: 100 }),
    mon(547, 'Whimsicott', ['Grass', 'Fairy'], { hp: 60, atk: 67, def: 85, spa: 77, spd: 75, spe: 116 }),
    mon(28, 'Sandslash-Alola', ['Ice', 'Steel'], { hp: 75, atk: 110, def: 120, spa: 30, spd: 65, spe: 75 }),
    mon(59, 'Arcanine-Hisui', ['Fire', 'Rock'], { hp: 95, atk: 115, def: 80, spa: 95, spd: 80, spe: 90 }),
    mon(31, 'Nidoqueen', ['Poison', 'Ground'], { hp: 90, atk: 92, def: 87, spa: 75, spd: 85, spe: 76 }),
    mon(73, 'Tentacruel', ['Water', 'Poison'], { hp: 80, atk: 70, def: 65, spa: 80, spd: 120, spe: 100 }),
    mon(812, 'Rillaboom', ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
    mon(445, 'Garchomp', ['Dragon', 'Ground'], { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 }),
    mon(485, 'Heatran', ['Fire', 'Steel'], { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 }),
    mon(149, 'Dragonite', ['Dragon', 'Flying'], { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 }),
    mon(3, 'Venusaur', ['Grass', 'Poison'], { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 }),
  ] as any);

  await PokemonSet.create([
    set('Sandslash-Alola', 'Muscle Band', 'Slush Rush', 'Naive', { hp: 0, atk: 124, def: 0, spa: 124, spd: 8, spe: 252 }, ['Ice Spinner', 'Iron Head', 'Protect', 'Rapid Spin']),
    set('Arcanine-Hisui', 'Covert Cloak', 'Intimidate', 'Adamant', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Flare Blitz', 'Rock Slide', 'Protect', 'High Horsepower']),
    set('Nidoqueen', 'Iapapa Berry', 'Poison Point', 'Sassy', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Poison Jab', 'High Horsepower', 'Protect', 'Rock Slide']),
    set('Tentacruel', 'Black Sludge', 'Clear Body', 'Timid', { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 }, ['Muddy Water', 'Sludge Bomb', 'Icy Wind', 'Protect']),
    set('Rillaboom', 'Assault Vest', 'Grassy Surge', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']),
    set('Garchomp', 'Rocky Helmet', 'Rough Skin', 'Jolly', { hp: 252, atk: 4, def: 0, spa: 0, spd: 0, spe: 252 }, ['Dragon Claw', 'Earthquake', 'Rock Slide', 'Protect']),
    set('Heatran', 'Safety Goggles', 'Flash Fire', 'Calm', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Heat Wave', 'Earth Power', 'Protect', 'Wide Guard']),
    set('Dragonite', 'Loaded Dice', 'Multiscale', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Scale Shot', 'Extreme Speed', 'Low Kick', 'Protect']),
    set('Venusaur', 'Life Orb', 'Chlorophyll', 'Modest', { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 }, ['Giga Drain', 'Sludge Bomb', 'Sleep Powder', 'Protect']),
  ] as any);

  const service = new LeadStrategyRecommendationService();
  const result: any = await service.execute({
    lead: [{ name: 'Charizard-Mega-Y' }, { name: 'Whimsicott' }],
    format: FORMAT, leadMode: 'fixed-lead', allowLegendaries: false, teamIdentity: 'archetype-regression-sun',
  });

  const strategyIds = (result.strategies ?? []).map((s: any) => s.strategy.id);
  for (const expected of ['sun_offense', 'tailwind_rush', 'defensive_core']) {
    assert(
      strategyIds.includes(expected),
      `Com weaknessPenaltyWeight=0.6, esperava ${expected} entre as estratégias aceitas, mas foram: ${strategyIds.join(', ') || '(nenhuma)'}`,
    );
  }
  console.log(`  ✅ sun_offense/tailwind_rush/defensive_core: aceitas (${strategyIds.join(', ')})`);
}

async function testTrickRoom(db: IsolatedTestDatabase): Promise<void> {
  await Pokemon.create([
    mon(3212, 'Farigiraf', ['Normal', 'Psychic'], { hp: 120, atk: 90, def: 70, spa: 110, spd: 70, spe: 60 }),
    mon(992, 'Iron Hands', ['Fighting', 'Electric'], { hp: 154, atk: 140, def: 108, spa: 50, spd: 68, spe: 50 }),
    mon(901, 'Ursaluna', ['Ground', 'Normal'], { hp: 130, atk: 140, def: 105, spa: 45, spd: 80, spe: 50 }),
    mon(876, 'Indeedee-F', ['Psychic', 'Normal'], { hp: 70, atk: 55, def: 65, spa: 95, spd: 105, spe: 95 }),
    mon(324, 'Torkoal', ['Fire'], { hp: 70, atk: 85, def: 140, spa: 85, spd: 70, spe: 20 }),
    mon(591, 'Amoonguss', ['Grass', 'Poison'], { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 }),
    mon(858, 'Hatterene', ['Psychic', 'Fairy'], { hp: 57, atk: 90, def: 95, spa: 136, spd: 103, spe: 29 }),
    mon(812, 'Rillaboom', ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
  ] as any);

  await PokemonSet.create([
    set('Farigiraf', 'Twisted Spoon', 'Armor Tail', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Trick Room', 'Psychic', 'Hyper Voice', 'Protect']),
    set('Iron Hands', 'Assault Vest', 'Quark Drive', 'Brave', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Close Combat', 'Wild Charge', 'Fake Out', 'Drain Punch']),
    set('Ursaluna', 'Flame Orb', 'Guts', 'Brave', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Facade', 'Earthquake', 'Headlong Rush', 'Protect']),
    set('Indeedee-F', 'Sitrus Berry', 'Psychic Surge', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Follow Me', 'Psychic', 'Helping Hand', 'Protect']),
    set('Torkoal', 'Charcoal', 'Drought', 'Quiet', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Eruption', 'Earth Power', 'Protect', 'Yawn']),
    set('Amoonguss', 'Sitrus Berry', 'Regenerator', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect']),
    set('Hatterene', 'Safety Goggles', 'Magic Bounce', 'Quiet', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Dazzling Gleam', 'Mystical Fire', 'Trick Room', 'Protect']),
    set('Rillaboom', 'Assault Vest', 'Grassy Surge', 'Brave', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']),
  ] as any);

  const service = new LeadStrategyRecommendationService();
  const result: any = await service.execute({
    lead: [{ name: 'Farigiraf' }, { name: 'Iron Hands' }],
    format: FORMAT, leadMode: 'fixed-lead', allowLegendaries: false, teamIdentity: 'archetype-regression-tr',
  });

  const strategyIds = (result.strategies ?? []).map((s: any) => s.strategy.id);
  assert(
    strategyIds.includes('trick_room'),
    `Com weaknessPenaltyWeight=0.6, esperava trick_room entre as estratégias aceitas, mas foram: ${strategyIds.join(', ') || '(nenhuma)'}`,
  );
  console.log(`  ✅ trick_room: aceita (${strategyIds.join(', ')})`);
}

async function testRainOffense(db: IsolatedTestDatabase): Promise<void> {
  await Pokemon.create([
    mon(279, 'Pelipper', ['Water', 'Flying'], { hp: 60, atk: 50, def: 100, spa: 95, spd: 70, spe: 65 }),
    mon(902, 'Basculegion-M', ['Water', 'Ghost'], { hp: 120, atk: 112, def: 65, spa: 80, spd: 75, spe: 78 }),
    mon(550, 'Barraskewda', ['Water'], { hp: 61, atk: 123, def: 60, spa: 60, spd: 60, spe: 136 }),
    mon(272, 'Ludicolo', ['Water', 'Grass'], { hp: 80, atk: 70, def: 70, spa: 90, spd: 100, spe: 70 }),
    mon(983, 'Kingambit', ['Dark', 'Steel'], { hp: 100, atk: 135, def: 120, spa: 60, spd: 85, spe: 50 }),
    mon(591, 'Amoonguss', ['Grass', 'Poison'], { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 }),
    mon(1017, 'Archaludon', ['Steel', 'Dragon'], { hp: 88, atk: 60, def: 122, spa: 118, spd: 85, spe: 72 }),
    mon(812, 'Rillaboom', ['Grass'], { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 }),
  ] as any);

  await PokemonSet.create([
    set('Pelipper', 'Damp Rock', 'Drizzle', 'Bold', { hp: 252, atk: 0, def: 252, spa: 4, spd: 0, spe: 0 }, ['Hurricane', 'Scald', 'Tailwind', 'Protect']),
    set('Basculegion-M', 'Choice Band', 'Swift Swim', 'Adamant', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Wave Crash', 'Aqua Jet', 'Last Respects', 'Liquidation']),
    set('Barraskewda', 'Choice Band', 'Swift Swim', 'Adamant', { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ['Liquidation', 'Close Combat', 'Flip Turn', 'Aqua Jet']),
    set('Ludicolo', 'Life Orb', 'Swift Swim', 'Modest', { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 }, ['Hydro Pump', 'Giga Drain', 'Ice Beam', 'Protect']),
    set('Kingambit', 'Black Glasses', 'Supreme Overlord', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect']),
    set('Amoonguss', 'Sitrus Berry', 'Regenerator', 'Sassy', { hp: 252, atk: 0, def: 4, spa: 0, spd: 252, spe: 0 }, ['Spore', 'Rage Powder', 'Pollen Puff', 'Protect']),
    set('Archaludon', 'Assault Vest', 'Stamina', 'Modest', { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 }, ['Electro Shot', 'Flash Cannon', 'Draco Meteor', 'Body Press']),
    set('Rillaboom', 'Assault Vest', 'Grassy Surge', 'Adamant', { hp: 252, atk: 252, def: 0, spa: 0, spd: 4, spe: 0 }, ['Wood Hammer', 'Grassy Glide', 'U-turn', 'Fake Out']),
  ] as any);

  const service = new LeadStrategyRecommendationService();
  const result: any = await service.execute({
    lead: [{ name: 'Pelipper' }, { name: 'Basculegion-M' }],
    format: FORMAT, leadMode: 'fixed-lead', allowLegendaries: false, teamIdentity: 'archetype-regression-rain',
  });

  const strategyIds = (result.strategies ?? []).map((s: any) => s.strategy.id);
  assert(
    strategyIds.includes('rain_offense'),
    `Com weaknessPenaltyWeight=0.6, esperava rain_offense entre as estratégias aceitas, mas foram: ${strategyIds.join(', ') || '(nenhuma)'}`,
  );
  console.log(`  ✅ rain_offense: aceita (${strategyIds.join(', ')})`);
}

async function main(): Promise<void> {
  console.log('🧪 Regressão dos 5 arquétipos do Build-Around-Lead com weaknessPenaltyWeight=0.6...');

  let db = await connectIsolatedTestDatabase();
  try {
    await testSunTailwindDefensiveCore(db);
  } finally {
    await db.dispose();
  }

  db = await connectIsolatedTestDatabase();
  try {
    await testTrickRoom(db);
  } finally {
    await db.dispose();
  }

  db = await connectIsolatedTestDatabase();
  try {
    await testRainOffense(db);
  } finally {
    await db.dispose();
  }

  console.log('\n✅ Todos os 5 arquétipos continuam aceitando pelo menos 1 estratégia com weaknessPenaltyWeight=0.6.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Regressão de arquétipos falhou:', error);
    process.exit(1);
  });
