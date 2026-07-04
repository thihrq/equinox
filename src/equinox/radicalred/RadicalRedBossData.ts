import { RadicalRedDataPack } from './RadicalRedBossProfile';

export const RADICAL_RED_4_1_HARDCORE_INDIGO_LEAGUE: RadicalRedDataPack = {
  id: 'radicalred_4_1_hardcore_indigo_league',
  game: 'radicalred',
  version: '4.1',
  mode: 'hardcore',
  label: 'Radical Red 4.1 Hardcore — Indigo League',
  sourceName: 'Radical Red Official Docs Drive / Restricted-Hardcore Mode Boss Trainers Teams / Indigo League snapshot',
  sourceUrl: 'https://docs.google.com/spreadsheets/d/1jDbKFA30xo8csPHZNLtsmqs781bW_Xb9mKoPYyE6KK8/edit?usp=drive_link',
  sourceUpdatedAt: '2024-03-22',
  dataVersion: 'rr-4.1-hardcore-indigo-v1',
  dataStatus: 'verified',
  dataHash: 'rr41-hardcore-indigo-league-v1',
  warnings: [
    'Radical Red is community-maintained and can change between patches. Revalidate this Hardcore pack against the official Drive whenever a new public release appears.',
    'This pack targets the Radical Red 4.1 Hardcore / Restricted Indigo League gauntlet only. Normal Mode is intentionally not used for team-builder scoring.',
    'Hardcore Mode auto-enables Minimal Grinding Mode and has unique battle restrictions, so recommendations should be interpreted as scenario-specific.',
  ],
  bosses: [
    {
      id: 'lorelei',
      name: 'Lorelei',
      stage: 'elite_four',
      order: 1,
      notes: [
        'Lorelei is evaluated as a weather doubles gate, not as a generic Ice trainer.',
        'The snow variant pressures with Aurora Veil, Blizzard spam, Freeze-Dry coverage, and Slush Rush tempo.',
        'The rain variant pressures with Drizzle, Swift Swim tempo, Kyogre-Primal, Walking Wake, and Iron Bundle.',
      ],
      requiredAnswers: [
        'Weather control or immediate weather punishment',
        'Reliable Water/Ice/Grass/Electric counterplay across both variants',
        'Speed control that still works into Slush Rush and rain pressure',
      ],
      variants: [
        {
          id: 'lorelei_snow',
          label: 'Snow Team',
          battleEffect: 'Doubles',
          pokemon: [
            { name: 'Ninetales-A', types: ['Ice', 'Fairy'], category: 'Special', baseSpeed: 109, importance: 91, ability: 'Snow Warning', item: 'Light Clay', moves: ['Blizzard', 'Aurora Veil', 'Freeze-Dry', 'Snowscape'], tags: ['weather', 'aurora veil', 'screen setter', 'freeze-dry'] },
            { name: 'Glaceon', types: ['Ice'], category: 'Special', baseSpeed: 75, importance: 86, ability: 'Slush Rush', item: 'Choice Specs', moves: ['Blizzard', 'Earth Power', 'Freeze-Dry', 'HP Fire'], tags: ['slush rush', 'special breaker', 'freeze-dry'] },
            { name: 'Rotom-W', types: ['Electric', 'Water'], category: 'Special', baseSpeed: 86, importance: 82, ability: 'Levitate', item: 'Sitrus Berry', moves: ['Volt Switch', 'Scald', 'Thunderbolt', 'Thunder Wave'], tags: ['pivot', 'speed control', 'water pressure'] },
            { name: 'Calyrex-I', types: ['Psychic', 'Ice'], category: 'Physical', baseSpeed: 50, importance: 94, ability: 'As One', item: 'Assault Vest', moves: ['Glacial Lance', 'Zen Headbutt', 'Seed Bomb', 'High Horsepower'], tags: ['legendary', 'physical breaker', 'bulky threat'] },
            { name: 'Abomasnow-Mega', types: ['Grass', 'Ice'], category: 'Special', baseSpeed: 60, importance: 87, ability: 'Snow Warning', item: 'Abomasite', moves: ['Blizzard', 'Focus Blast', 'HP Fire', 'Giga Drain'], tags: ['mega', 'weather', 'mixed coverage'] },
            { name: 'Baxcalibur', types: ['Dragon', 'Ice'], category: 'Physical', baseSpeed: 87, importance: 90, ability: 'Thermal Exchange', item: 'Dragon Fang', moves: ['Glaive Rush', 'Ice Shard', 'Icicle Crash', 'Protect'], tags: ['dragon', 'priority', 'physical breaker'] },
          ],
        },
        {
          id: 'lorelei_rain',
          label: 'Rain Team',
          battleEffect: 'Doubles',
          pokemon: [
            { name: 'Politoed', types: ['Water'], category: 'Special', baseSpeed: 70, importance: 86, ability: 'Drizzle', tags: ['weather', 'rain setter', 'support'] },
            { name: 'Ogerpon-W', types: ['Grass', 'Water'], category: 'Physical', baseSpeed: 110, importance: 90, tags: ['water absorb', 'physical breaker', 'grass pressure'] },
            { name: 'Swampert-Mega', types: ['Water', 'Ground'], category: 'Physical', baseSpeed: 70, importance: 94, ability: 'Swift Swim', tags: ['mega', 'swift swim', 'ground pressure'] },
            { name: 'Walking Wake', types: ['Water', 'Dragon'], category: 'Special', baseSpeed: 109, importance: 94, tags: ['dragon', 'special breaker', 'rain abuse'] },
            { name: 'Kyogre-P', types: ['Water'], category: 'Special', baseSpeed: 90, importance: 98, tags: ['primal', 'weather', 'legendary', 'special breaker'] },
            { name: 'Iron Bundle', types: ['Ice', 'Water'], category: 'Special', baseSpeed: 136, importance: 95, tags: ['speed control', 'freeze-dry', 'special sweeper'] },
          ],
        },
      ],
    },
    {
      id: 'bruno',
      name: 'Bruno',
      stage: 'elite_four',
      order: 2,
      notes: [
        'Bruno is evaluated as a Fighting-heavy physical pressure check with Zacian-Crowned and Mega Lucario endgame risk.',
        'The Great Tusk team is hazard-and-pressure oriented; the Infernape team adds Taunt and mixed tempo.',
      ],
      requiredAnswers: [
        'A Zacian-Crowned answer that is not the only physical wall',
        'Ground/Fighting resistances or immunities that can still threaten back',
        'Emergency speed control against Iron Valiant and Lucario-Mega',
      ],
      variants: [
        {
          id: 'bruno_team_one',
          label: 'Team One — Great Tusk pressure',
          pokemon: [
            { name: 'Great Tusk', types: ['Ground', 'Fighting'], category: 'Physical', baseSpeed: 87, importance: 91, ability: 'Protosynthesis', item: 'Focus Sash', moves: ['Headlong Rush', 'Close Combat', 'Stealth Rock', 'Knock Off'], tags: ['hazards', 'physical breaker', 'ground pressure'] },
            { name: 'Urshifu-R', types: ['Fighting', 'Water'], category: 'Physical', baseSpeed: 97, importance: 90, ability: 'Unseen Fist', item: 'Mystic Water', moves: ['Surging Strikes', 'Close Combat', 'Swords Dance', 'Thunder Punch'], tags: ['contact pressure', 'swords dance', 'water pressure'] },
            { name: 'Iron Valiant', types: ['Fairy', 'Fighting'], category: 'Special', baseSpeed: 116, importance: 92, ability: 'Quark Drive', item: 'Booster Energy', moves: ['Psyshock', 'Shadow Ball', 'Moonblast', 'Calm Mind'], tags: ['booster energy', 'setup', 'special breaker'] },
            { name: 'Iron Hands', types: ['Fighting', 'Electric'], category: 'Physical', baseSpeed: 50, importance: 84, ability: 'Quark Drive', item: 'Assault Vest', moves: ['Drain Punch', 'Fake Out', 'Plasma Fists', 'Ice Punch'], tags: ['fake out', 'bulky attacker', 'electric pressure'] },
            { name: 'Zacian-C', types: ['Fairy', 'Steel'], category: 'Physical', baseSpeed: 148, importance: 99, ability: 'Intrepid Sword', item: 'Rusted Sword', moves: ['Swords Dance', 'Behemoth Blade', 'Close Combat', 'Wild Charge'], tags: ['legendary', 'setup', 'speed control', 'physical sweeper'] },
            { name: 'Lucario-Mega', types: ['Fighting', 'Steel'], category: 'Special', baseSpeed: 112, importance: 93, ability: 'Adaptability', item: 'Lucarionite', moves: ['Nasty Plot', 'Aura Sphere', 'Vacuum Wave', 'Flash Cannon'], tags: ['mega', 'setup', 'priority', 'special breaker'] },
          ],
        },
        {
          id: 'bruno_team_two',
          label: 'Team Two — Infernape / Urshifu-S pressure',
          pokemon: [
            { name: 'Infernape', types: ['Fire', 'Fighting'], category: 'Mixed', baseSpeed: 113, importance: 88, ability: 'Blaze', item: 'Focus Sash', moves: ['Taunt', 'Pyro Ball', 'Stealth Rock', 'Close Combat'], tags: ['taunt', 'hazards', 'mixed pressure'] },
            { name: 'Urshifu-S', types: ['Fighting', 'Dark'], category: 'Physical', baseSpeed: 97, importance: 91, ability: 'Unseen Fist', item: 'Black Glasses', moves: ['Wicked Blow', 'Swords Dance', 'Close Combat', 'Sucker Punch'], tags: ['sucker punch', 'setup', 'dark pressure'] },
            { name: 'Kommo-o', types: ['Dragon', 'Fighting'], category: 'Special', baseSpeed: 85, importance: 86, ability: 'Overcoat', item: 'Throat Spray', moves: ['Clanging Scales', 'Clangorous Soul', 'Aura Sphere', 'Flash Cannon'], tags: ['setup', 'dragon pressure', 'special sweeper'] },
            { name: 'Iron Valiant', types: ['Fairy', 'Fighting'], category: 'Special', baseSpeed: 116, importance: 92, ability: 'Quark Drive', item: 'Booster Energy', moves: ['Moonblast', 'Thunderbolt', 'Aura Sphere', 'Shadow Ball'], tags: ['booster energy', 'speed control', 'special breaker'] },
            { name: 'Zacian-C', types: ['Fairy', 'Steel'], category: 'Physical', baseSpeed: 148, importance: 99, ability: 'Intrepid Sword', item: 'Rusted Sword', moves: ['Swords Dance', 'Behemoth Blade', 'Close Combat', 'Wild Charge'], tags: ['legendary', 'setup', 'physical sweeper'] },
            { name: 'Lucario-Mega', types: ['Fighting', 'Steel'], category: 'Physical', baseSpeed: 112, importance: 92, ability: 'Adaptability', item: 'Lucarionite', moves: ['Bullet Punch', 'Meteor Mash', 'Close Combat', 'Swords Dance'], tags: ['mega', 'setup', 'priority', 'physical sweeper'] },
          ],
        },
      ],
    },
    {
      id: 'agatha',
      name: 'Agatha',
      stage: 'elite_four',
      order: 3,
      notes: [
        'Agatha is evaluated as a Ghost/Dark/Psychic tempo fight with Focus Sash leads, Shadow Tag pressure, and setup theft risk.',
        'Do not overcommit boosts before Marshadow is controlled.',
      ],
      requiredAnswers: [
        'Dark/Ghost/Fairy counterplay that handles Focus Sash and Shadow Tag pressure',
        'A plan for Marshadow stealing boosts with Spectral Thief',
        'Speed control or priority against Mega Gengar, Flutter Mane, and Chien-Pao',
      ],
      variants: [
        {
          id: 'agatha_team_one',
          label: 'Team One — Hisuian Zoroark / Roaring Moon',
          pokemon: [
            { name: 'Zoroark-H', types: ['Normal', 'Ghost'], category: 'Special', baseSpeed: 110, importance: 88, ability: 'Illusion', item: 'Focus Sash', moves: ['Taunt', 'Hyper Voice', 'Shadow Ball', 'Flamethrower'], tags: ['illusion', 'focus sash', 'taunt'] },
            { name: 'Gholdengo', types: ['Steel', 'Ghost'], category: 'Special', baseSpeed: 84, importance: 88, ability: 'Good As Gold', item: 'Air Balloon', moves: ['Make It Rain', 'Thunder Wave', 'Shadow Ball', 'Focus Blast'], tags: ['status control', 'steel pressure', 'ghost pressure'] },
            { name: 'Marshadow', types: ['Fighting', 'Ghost'], category: 'Physical', baseSpeed: 125, importance: 96, ability: 'Technician', item: 'Focus Sash', moves: ['Drain Punch', 'Bulk Up', 'Spectral Thief', 'Shadow Sneak'], tags: ['boost theft', 'priority', 'setup', 'focus sash'] },
            { name: 'Roaring Moon', types: ['Dragon', 'Dark'], category: 'Physical', baseSpeed: 119, importance: 92, ability: 'Protosynthesis', item: 'Booster Energy', moves: ['Dragon Dance', 'Knock Off', 'Earthquake', 'Iron Head'], tags: ['booster energy', 'dragon dance', 'physical sweeper'] },
            { name: 'Chi-Yu', types: ['Dark', 'Fire'], category: 'Special', baseSpeed: 100, importance: 91, ability: 'Beads of Ruin', item: 'Charcoal', moves: ['Dark Pulse', 'Flamethrower', 'Psychic', 'HP Grass'], tags: ['special breaker', 'dark pressure', 'fire pressure'] },
            { name: 'Gengar-Mega', types: ['Ghost', 'Poison'], category: 'Special', baseSpeed: 130, importance: 96, ability: 'Shadow Tag', item: 'Gengarite', moves: ['Shadow Ball', 'Sludge Wave', 'Nasty Plot', 'Focus Blast'], tags: ['mega', 'shadow tag', 'setup', 'special sweeper'] },
          ],
        },
        {
          id: 'agatha_team_two',
          label: 'Team Two — Zoroark / Flutter Mane / Chien-Pao',
          pokemon: [
            { name: 'Zoroark', types: ['Dark'], category: 'Special', baseSpeed: 105, importance: 87, ability: 'Illusion', item: 'Focus Sash', moves: ['Taunt', 'Dark Pulse', 'Flamethrower', 'Sludge Bomb'], tags: ['illusion', 'focus sash', 'taunt'] },
            { name: 'Gholdengo', types: ['Steel', 'Ghost'], category: 'Special', baseSpeed: 84, importance: 88, ability: 'Good As Gold', item: 'Air Balloon', moves: ['Make It Rain', 'Nasty Plot', 'Shadow Ball', 'Focus Blast'], tags: ['setup', 'steel pressure', 'ghost pressure'] },
            { name: 'Marshadow', types: ['Fighting', 'Ghost'], category: 'Physical', baseSpeed: 125, importance: 96, ability: 'Technician', item: 'Focus Sash', moves: ['Spectral Thief', 'Close Combat', 'Shadow Sneak', 'Bulk Up'], tags: ['boost theft', 'priority', 'setup', 'focus sash'] },
            { name: 'Flutter Mane', types: ['Ghost', 'Fairy'], category: 'Special', baseSpeed: 135, importance: 95, ability: 'Protosynthesis', item: 'Booster Energy', moves: ['Shadow Ball', 'Moonblast', 'Mystical Fire', 'Psyshock'], tags: ['booster energy', 'speed control', 'special sweeper'] },
            { name: 'Chien-Pao', types: ['Dark', 'Ice'], category: 'Physical', baseSpeed: 135, importance: 94, ability: 'Swords of Ruin', item: 'Black Glasses', moves: ['Sacred Sword', 'Crunch', 'Icicle Crash', 'Ice Shard'], tags: ['priority', 'speed control', 'physical sweeper'] },
            { name: 'Gengar-Mega', types: ['Ghost', 'Poison'], category: 'Special', baseSpeed: 130, importance: 96, ability: 'Shadow Tag', item: 'Gengarite', moves: ['Shadow Ball', 'Sludge Wave', 'Nasty Plot', 'Aura Sphere'], tags: ['mega', 'shadow tag', 'setup', 'special sweeper'] },
          ],
        },
      ],
    },
    {
      id: 'lance',
      name: 'Lance',
      stage: 'elite_four',
      order: 4,
      notes: [
        'Lance is evaluated as Dragon/Flying/Steel boss pressure with hazards, Dark Hole, Multiscale setup, Primal Dialga, and Mega Salamence.',
        'The lead slot changes between Aerodactyl and Garchomp, but both demand anti-hazard and anti-setup discipline.',
      ],
      requiredAnswers: [
        'Ice/Fairy/Dragon pressure into Dragonite, Garchomp, and Mega Salamence',
        'Steel/Ground/Fighting counterplay into Melmetal and Dialga-Primal',
        'A plan to prevent or punish Dragon Dance snowballing',
      ],
      variants: [
        {
          id: 'lance_aerodactyl',
          label: 'Team One — Aerodactyl lead',
          pokemon: [
            { name: 'Aerodactyl', types: ['Rock', 'Flying'], category: 'Physical', baseSpeed: 130, importance: 88, ability: 'Pressure', item: 'Focus Sash', moves: ['Stealth Rock', 'Earthquake', 'Taunt', 'Stone Edge'], tags: ['hazards', 'taunt', 'focus sash', 'speed control'] },
            { name: 'Melmetal', types: ['Steel'], category: 'Physical', baseSpeed: 34, importance: 88, ability: 'Iron Fist', item: 'Assault Vest', moves: ['Double Iron Bash', 'Earthquake', 'Thunder Punch', 'Ice Punch'], tags: ['bulky attacker', 'steel pressure'] },
            { name: 'Iron Jugulis', types: ['Dark', 'Flying'], category: 'Special', baseSpeed: 108, importance: 89, ability: 'Quark Drive', item: 'Booster Energy', moves: ['Dark Hole', 'Flamethrower', 'Aeroblast', 'Earth Power'], tags: ['booster energy', 'sleep pressure', 'special breaker'] },
            { name: 'Dragonite', types: ['Dragon', 'Flying'], category: 'Physical', baseSpeed: 80, importance: 92, ability: 'Multiscale', item: 'Weakness Policy', moves: ['Extreme Speed', 'Dragon Dance', 'Dual Wingbeat', 'Earthquake'], tags: ['priority', 'setup', 'weakness policy'] },
            { name: 'Dialga-Primal', types: ['Steel', 'Dragon'], category: 'Mixed', baseSpeed: 90, importance: 98, ability: 'Primal Armor', item: 'Adamant Orb', moves: ['Roar of Time', 'Flash Cannon', 'Rest', 'Sleep Talk'], tags: ['primal', 'legendary', 'bulky threat'] },
            { name: 'Salamence-Mega', types: ['Dragon', 'Flying'], category: 'Physical', baseSpeed: 120, importance: 97, ability: 'Aerilate', item: 'Salamencite', moves: ['Dragon Dance', 'Double-Edge', 'Earthquake', 'Fire Fang'], tags: ['mega', 'setup', 'physical sweeper'] },
          ],
        },
        {
          id: 'lance_garchomp',
          label: 'Team Two — Garchomp lead',
          pokemon: [
            { name: 'Garchomp', types: ['Dragon', 'Ground'], category: 'Physical', baseSpeed: 102, importance: 90, ability: 'Rough Skin', item: 'Focus Sash', moves: ['Stealth Rock', 'Earthquake', 'Stone Edge', 'Roar'], tags: ['hazards', 'phazing', 'ground pressure'] },
            { name: 'Melmetal', types: ['Steel'], category: 'Physical', baseSpeed: 34, importance: 88, ability: 'Iron Fist', item: 'Assault Vest', moves: ['Double Iron Bash', 'Earthquake', 'Thunder Punch', 'Ice Punch'], tags: ['bulky attacker', 'steel pressure'] },
            { name: 'Iron Jugulis', types: ['Dark', 'Flying'], category: 'Special', baseSpeed: 108, importance: 89, ability: 'Quark Drive', item: 'Booster Energy', moves: ['Dark Hole', 'Flamethrower', 'Aeroblast', 'Earth Power'], tags: ['booster energy', 'sleep pressure', 'special breaker'] },
            { name: 'Dragonite', types: ['Dragon', 'Flying'], category: 'Physical', baseSpeed: 80, importance: 92, ability: 'Multiscale', item: 'Lum Berry', moves: ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Dual Wingbeat'], tags: ['priority', 'setup', 'lum berry'] },
            { name: 'Dialga-Primal', types: ['Steel', 'Dragon'], category: 'Mixed', baseSpeed: 90, importance: 98, ability: 'Primal Armor', item: 'Adamant Orb', moves: ['Roar of Time', 'Flash Cannon', 'Rest', 'Sleep Talk'], tags: ['primal', 'legendary', 'bulky threat'] },
            { name: 'Salamence-Mega', types: ['Dragon', 'Flying'], category: 'Physical', baseSpeed: 120, importance: 97, ability: 'Aerilate', item: 'Salamencite', moves: ['Dragon Dance', 'Double-Edge', 'Fire Fang', 'Earthquake'], tags: ['mega', 'setup', 'physical sweeper'] },
          ],
        },
      ],
    },
    {
      id: 'champion',
      name: 'Champion',
      stage: 'champion',
      order: 5,
      notes: [
        'Champion is evaluated as the final consistency check because the rival starter changes the central legendary slot.',
        'Pheromosa lead, Mega Metagross, Yveltal, Eternatus, and Choice Scarf Ditto are common across listed variants.',
      ],
      requiredAnswers: [
        'A plan for Pheromosa lead and Ditto reverse-sweep risk',
        'Steel/Dragon/Dark/Flying counterplay that does not collapse to one legendary slot',
        'A safe answer into Koraidon or Miraidon depending on rival starter branch',
      ],
      variants: [
        {
          id: 'champion_squirtle',
          label: 'Rival has Squirtle — Koraidon branch',
          trigger: 'Rival starter branch: Squirtle',
          pokemon: [
            { name: 'Pheromosa', types: ['Bug', 'Fighting'], category: 'Mixed', baseSpeed: 151, importance: 94, ability: 'Beast Boost', item: 'Focus Sash', moves: ['U-Turn', 'Close Combat', 'Triple Axel', 'Poison Jab'], tags: ['focus sash', 'speed control', 'mixed breaker'] },
            { name: 'Metagross-Mega', types: ['Steel', 'Psychic'], category: 'Physical', baseSpeed: 110, importance: 92, ability: 'Tough Claws', item: 'Metagrossite', moves: ['Bullet Punch', 'Zen Headbutt', 'Fire Punch', 'Meteor Mash'], tags: ['mega', 'priority', 'steel pressure'] },
            { name: 'Koraidon', types: ['Fighting', 'Dragon'], category: 'Physical', baseSpeed: 135, importance: 100, ability: 'Orichalcum Pulse', item: 'Lum Berry', moves: ['Swords Dance', 'Collision Course', 'Dragon Claw', 'Flare Blitz'], tags: ['legendary', 'weather', 'setup', 'physical sweeper'] },
            { name: 'Yveltal', types: ['Dark', 'Flying'], category: 'Special', baseSpeed: 99, importance: 94, ability: 'Dark Aura', item: 'Assault Vest', moves: ['Oblivion Wing', 'Dark Hole', 'Heat Wave', 'Sucker Punch'], tags: ['legendary', 'dark pressure', 'recovery pressure'] },
            { name: 'Eternatus', types: ['Poison', 'Dragon'], category: 'Special', baseSpeed: 130, importance: 97, ability: 'Pressure', item: 'Power Herb', moves: ['Meteor Beam', 'Sludge Wave', 'Flamethrower', 'Dynamax Cannon'], tags: ['legendary', 'special breaker', 'meteor beam'] },
            { name: 'Ditto', types: ['Normal'], category: 'Mixed', baseSpeed: 48, importance: 92, ability: 'Imposter', item: 'Choice Scarf', moves: ['Transform'], tags: ['choice scarf', 'reverse sweep', 'imposter'] },
          ],
        },
        {
          id: 'champion_charmander',
          label: 'Rival has Charmander — Miraidon Parabolic Charge branch',
          trigger: 'Rival starter branch: Charmander',
          pokemon: [
            { name: 'Pheromosa', types: ['Bug', 'Fighting'], category: 'Mixed', baseSpeed: 151, importance: 94, ability: 'Beast Boost', item: 'Focus Sash', moves: ['U-Turn', 'Close Combat', 'Triple Axel', 'Poison Jab'], tags: ['focus sash', 'speed control', 'mixed breaker'] },
            { name: 'Metagross-Mega', types: ['Steel', 'Psychic'], category: 'Physical', baseSpeed: 110, importance: 92, ability: 'Tough Claws', item: 'Metagrossite', moves: ['Bullet Punch', 'Zen Headbutt', 'Fire Punch', 'Meteor Mash'], tags: ['mega', 'priority', 'steel pressure'] },
            { name: 'Miraidon', types: ['Electric', 'Dragon'], category: 'Special', baseSpeed: 135, importance: 100, ability: 'Hadron Engine', item: 'Leftovers', moves: ['Calm Mind', 'Parabolic Charge', 'Dragon Pulse', 'HP Fire'], tags: ['legendary', 'electric terrain', 'setup', 'special sweeper'] },
            { name: 'Yveltal', types: ['Dark', 'Flying'], category: 'Special', baseSpeed: 99, importance: 94, ability: 'Dark Aura', item: 'Assault Vest', moves: ['Oblivion Wing', 'Dark Hole', 'Heat Wave', 'Sucker Punch'], tags: ['legendary', 'dark pressure', 'recovery pressure'] },
            { name: 'Eternatus', types: ['Poison', 'Dragon'], category: 'Special', baseSpeed: 130, importance: 97, ability: 'Pressure', item: 'Power Herb', moves: ['Meteor Beam', 'Sludge Wave', 'Flamethrower', 'Dynamax Cannon'], tags: ['legendary', 'special breaker', 'meteor beam'] },
            { name: 'Ditto', types: ['Normal'], category: 'Mixed', baseSpeed: 48, importance: 92, ability: 'Imposter', item: 'Choice Scarf', moves: ['Transform'], tags: ['choice scarf', 'reverse sweep', 'imposter'] },
          ],
        },
        {
          id: 'champion_bulbasaur',
          label: 'Rival has Bulbasaur — Miraidon Electro Drift branch',
          trigger: 'Rival starter branch: Bulbasaur',
          pokemon: [
            { name: 'Pheromosa', types: ['Bug', 'Fighting'], category: 'Mixed', baseSpeed: 151, importance: 94, ability: 'Beast Boost', item: 'Focus Sash', moves: ['U-Turn', 'Close Combat', 'Triple Axel', 'Poison Jab'], tags: ['focus sash', 'speed control', 'mixed breaker'] },
            { name: 'Metagross-Mega', types: ['Steel', 'Psychic'], category: 'Physical', baseSpeed: 110, importance: 92, ability: 'Tough Claws', item: 'Metagrossite', moves: ['Bullet Punch', 'Zen Headbutt', 'Fire Punch', 'Meteor Mash'], tags: ['mega', 'priority', 'steel pressure'] },
            { name: 'Miraidon', types: ['Electric', 'Dragon'], category: 'Special', baseSpeed: 135, importance: 100, ability: 'Hadron Engine', item: 'Leftovers', moves: ['Calm Mind', 'Electro Drift', 'Dragon Pulse', 'HP Fire'], tags: ['legendary', 'electric terrain', 'setup', 'special sweeper'] },
            { name: 'Yveltal', types: ['Dark', 'Flying'], category: 'Special', baseSpeed: 99, importance: 94, ability: 'Dark Aura', item: 'Assault Vest', moves: ['Oblivion Wing', 'Dark Hole', 'Heat Wave', 'Sucker Punch'], tags: ['legendary', 'dark pressure', 'recovery pressure'] },
            { name: 'Eternatus', types: ['Poison', 'Dragon'], category: 'Special', baseSpeed: 130, importance: 97, ability: 'Pressure', item: 'Power Herb', moves: ['Meteor Beam', 'Sludge Wave', 'Flamethrower', 'Dynamax Cannon'], tags: ['legendary', 'special breaker', 'meteor beam'] },
            { name: 'Ditto', types: ['Normal'], category: 'Mixed', baseSpeed: 48, importance: 92, ability: 'Imposter', item: 'Choice Scarf', moves: ['Transform'], tags: ['choice scarf', 'reverse sweep', 'imposter'] },
          ],
        },
      ],
    },
  ],
};

export function getRadicalRedDataPack(format: string): RadicalRedDataPack | undefined {
  const normalized = (format || '').toLowerCase().replace(/[\s-]+/g, '_');

  if (
    normalized === 'radical_red' ||
    normalized === 'radicalred' ||
    normalized === 'radical_red_hardcore' ||
    normalized === 'radical_red_restricted' ||
    normalized === 'radical_red_hardmode' ||
    normalized === 'rr_hardcore' ||
    normalized === 'rr_restricted'
  ) {
    return RADICAL_RED_4_1_HARDCORE_INDIGO_LEAGUE;
  }

  return undefined;
}
