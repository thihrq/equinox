import { PokemonData } from '../core/AnalysisContext';

export type VanillaGameProfileStatus = 'verified' | 'bootstrap' | 'pending';

export interface DexRange {
  from: number;
  to: number;
}

export interface VanillaGameProfile {
  id: string;
  label: string;
  shortLabel: string;
  game: string;
  poolLabel: string;
  poolStatus: VanillaGameProfileStatus;
  minDexNumber?: number;
  maxDexNumber?: number;
  allowedDexNumbers?: number[];
  allowedDexRanges?: DexRange[];
  strictPool: boolean;
  allowMegas: boolean;
  allowRegionalForms: boolean;
  warning?: string;
}

const MEGA_FORM_PATTERN = /-mega(?:-|$)/i;
const REGIONAL_OR_LATER_FORM_PATTERN = /-(alola|galar|hisui|paldea|totem|origin|therian|sky|white|black|battle-bond|bond|ash|school|blade|shield|dawn|dusk|midnight|ultra|primal)/i;

export class VanillaGameProfileRegistry {
  public normalizeFormat(format: string): string {
    const normalized = (format || 'vanilla')
      .toLowerCase()
      .trim()
      .replace(/[’']/g, '')
      .replace(/\+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .replace(/__+/g, '_');

    const aliases: Record<string, string> = {
      red: 'vanilla_red_blue_yellow',
      blue: 'vanilla_red_blue_yellow',
      yellow: 'vanilla_red_blue_yellow',
      red_blue: 'vanilla_red_blue_yellow',
      red_blue_yellow: 'vanilla_red_blue_yellow',
      pokemon_red: 'vanilla_red_blue_yellow',
      pokemon_blue: 'vanilla_red_blue_yellow',
      pokemon_yellow: 'vanilla_red_blue_yellow',
      vanilla_red: 'vanilla_red_blue_yellow',
      vanilla_blue: 'vanilla_red_blue_yellow',
      vanilla_yellow: 'vanilla_red_blue_yellow',
      vanilla_red_blue_yellow: 'vanilla_red_blue_yellow',

      fire_red: 'vanilla_fire_red',
      firered: 'vanilla_fire_red',
      frlg: 'vanilla_fire_red',
      firered_leafgreen: 'vanilla_fire_red',
      fire_red_leaf_green: 'vanilla_fire_red',
      fire_red_leafgreen: 'vanilla_fire_red',
      firered_leaf_green: 'vanilla_fire_red',
      leaf_green: 'vanilla_fire_red',
      leafgreen: 'vanilla_fire_red',
      pokemon_fire_red: 'vanilla_fire_red',
      pokemon_firered: 'vanilla_fire_red',
      vanilla_firered: 'vanilla_fire_red',
      vanilla_fire_red: 'vanilla_fire_red',
      vanilla_leaf_green: 'vanilla_fire_red',
      vanilla_leafgreen: 'vanilla_fire_red',

      gold: 'vanilla_gold_silver_crystal',
      silver: 'vanilla_gold_silver_crystal',
      crystal: 'vanilla_gold_silver_crystal',
      gold_silver: 'vanilla_gold_silver_crystal',
      gold_silver_crystal: 'vanilla_gold_silver_crystal',
      vanilla_gold: 'vanilla_gold_silver_crystal',
      vanilla_silver: 'vanilla_gold_silver_crystal',
      vanilla_crystal: 'vanilla_gold_silver_crystal',
      vanilla_gold_silver_crystal: 'vanilla_gold_silver_crystal',

      heartgold: 'vanilla_heartgold_soulsilver',
      soulsilver: 'vanilla_heartgold_soulsilver',
      heart_gold: 'vanilla_heartgold_soulsilver',
      soul_silver: 'vanilla_heartgold_soulsilver',
      hgss: 'vanilla_heartgold_soulsilver',
      vanilla_heartgold: 'vanilla_heartgold_soulsilver',
      vanilla_soulsilver: 'vanilla_heartgold_soulsilver',
      vanilla_heart_gold: 'vanilla_heartgold_soulsilver',
      vanilla_soul_silver: 'vanilla_heartgold_soulsilver',
      vanilla_heartgold_soulsilver: 'vanilla_heartgold_soulsilver',

      ruby: 'vanilla_ruby_sapphire',
      sapphire: 'vanilla_ruby_sapphire',
      ruby_sapphire: 'vanilla_ruby_sapphire',
      pokemon_ruby: 'vanilla_ruby_sapphire',
      pokemon_sapphire: 'vanilla_ruby_sapphire',
      vanilla_ruby: 'vanilla_ruby_sapphire',
      vanilla_sapphire: 'vanilla_ruby_sapphire',
      vanilla_ruby_sapphire: 'vanilla_ruby_sapphire',

      emerald: 'vanilla_emerald',
      pokemon_emerald: 'vanilla_emerald',
      vanilla_emerald: 'vanilla_emerald',

      diamond: 'vanilla_diamond_pearl',
      pearl: 'vanilla_diamond_pearl',
      diamond_pearl: 'vanilla_diamond_pearl',
      vanilla_diamond: 'vanilla_diamond_pearl',
      vanilla_pearl: 'vanilla_diamond_pearl',
      vanilla_diamond_pearl: 'vanilla_diamond_pearl',
      platinum: 'vanilla_platinum',
      vanilla_platinum: 'vanilla_platinum',

      black: 'vanilla_black_white',
      white: 'vanilla_black_white',
      black_white: 'vanilla_black_white',
      vanilla_black: 'vanilla_black_white',
      vanilla_white: 'vanilla_black_white',
      vanilla_black_white: 'vanilla_black_white',
      black_2: 'vanilla_black_2_white_2',
      white_2: 'vanilla_black_2_white_2',
      black2: 'vanilla_black_2_white_2',
      white2: 'vanilla_black_2_white_2',
      bw2: 'vanilla_black_2_white_2',
      black_2_white_2: 'vanilla_black_2_white_2',
      vanilla_black_2_white_2: 'vanilla_black_2_white_2',

      x: 'vanilla_x_y',
      y: 'vanilla_x_y',
      xy: 'vanilla_x_y',
      x_y: 'vanilla_x_y',
      pokemon_x: 'vanilla_x_y',
      pokemon_y: 'vanilla_x_y',
      vanilla_x: 'vanilla_x_y',
      vanilla_y: 'vanilla_x_y',
      vanilla_x_y: 'vanilla_x_y',

      omega_ruby: 'vanilla_omega_ruby_alpha_sapphire',
      alpha_sapphire: 'vanilla_omega_ruby_alpha_sapphire',
      oras: 'vanilla_omega_ruby_alpha_sapphire',
      omega_ruby_alpha_sapphire: 'vanilla_omega_ruby_alpha_sapphire',
      vanilla_omega_ruby: 'vanilla_omega_ruby_alpha_sapphire',
      vanilla_alpha_sapphire: 'vanilla_omega_ruby_alpha_sapphire',
      vanilla_omega_ruby_alpha_sapphire: 'vanilla_omega_ruby_alpha_sapphire',

      sun: 'vanilla_sun_moon',
      moon: 'vanilla_sun_moon',
      sun_moon: 'vanilla_sun_moon',
      vanilla_sun: 'vanilla_sun_moon',
      vanilla_moon: 'vanilla_sun_moon',
      vanilla_sun_moon: 'vanilla_sun_moon',
      ultra_sun: 'vanilla_ultra_sun_ultra_moon',
      ultra_moon: 'vanilla_ultra_sun_ultra_moon',
      ultra_sun_ultra_moon: 'vanilla_ultra_sun_ultra_moon',
      usum: 'vanilla_ultra_sun_ultra_moon',
      vanilla_ultra_sun_ultra_moon: 'vanilla_ultra_sun_ultra_moon',

      lets_go: 'vanilla_lets_go_pikachu_eevee',
      lets_go_pikachu: 'vanilla_lets_go_pikachu_eevee',
      lets_go_eevee: 'vanilla_lets_go_pikachu_eevee',
      lets_go_pikachu_eevee: 'vanilla_lets_go_pikachu_eevee',
      lgpe: 'vanilla_lets_go_pikachu_eevee',
      vanilla_lets_go_pikachu_eevee: 'vanilla_lets_go_pikachu_eevee',

      sword: 'vanilla_sword_shield',
      shield: 'vanilla_sword_shield',
      sword_shield: 'vanilla_sword_shield',
      swsh: 'vanilla_sword_shield',
      vanilla_sword: 'vanilla_sword_shield',
      vanilla_shield: 'vanilla_sword_shield',
      vanilla_sword_shield: 'vanilla_sword_shield',

      brilliant_diamond: 'vanilla_brilliant_diamond_shining_pearl',
      shining_pearl: 'vanilla_brilliant_diamond_shining_pearl',
      brilliant_diamond_shining_pearl: 'vanilla_brilliant_diamond_shining_pearl',
      bdsp: 'vanilla_brilliant_diamond_shining_pearl',
      vanilla_brilliant_diamond_shining_pearl: 'vanilla_brilliant_diamond_shining_pearl',

      legends_arceus: 'vanilla_legends_arceus',
      pokemon_legends_arceus: 'vanilla_legends_arceus',
      pla: 'vanilla_legends_arceus',
      vanilla_legends_arceus: 'vanilla_legends_arceus',

      scarlet: 'vanilla_scarlet_violet',
      violet: 'vanilla_scarlet_violet',
      scarlet_violet: 'vanilla_scarlet_violet',
      sv: 'vanilla_scarlet_violet',
      vanilla_scarlet_violet: 'vanilla_scarlet_violet',

      legends_za: 'vanilla_legends_za',
      legends_z_a: 'vanilla_legends_za',
      pokemon_legends_za: 'vanilla_legends_za',
      pokemon_legends_z_a: 'vanilla_legends_za',
      plza: 'vanilla_legends_za',
      vanilla_legends_za: 'vanilla_legends_za',
    };

    return aliases[normalized] ?? normalized;
  }

  public getProfile(format: string): VanillaGameProfile | undefined {
    return VANILLA_GAME_PROFILES[this.normalizeFormat(format)];
  }

  public isGameProfile(format: string): boolean {
    return this.getProfile(format) !== undefined;
  }

  public isPokemonAllowed(format: string, pokemon: PokemonData): boolean {
    const profile = this.getProfile(format);

    if (!profile || !profile.strictPool) return true;

    const dexNumber = Number((pokemon as PokemonData & { dexNumber?: number }).dexNumber ?? 0);
    const name = pokemon.name.toLowerCase();

    if (!profile.allowMegas && MEGA_FORM_PATTERN.test(name)) return false;
    if (!profile.allowRegionalForms && REGIONAL_OR_LATER_FORM_PATTERN.test(name)) return false;
    if (dexNumber <= 0) return false;

    if (profile.allowedDexNumbers?.includes(dexNumber)) return true;

    if (profile.allowedDexRanges?.length) {
      return profile.allowedDexRanges.some(range => dexNumber >= range.from && dexNumber <= range.to);
    }

    if (profile.minDexNumber && dexNumber < profile.minDexNumber) return false;
    if (profile.maxDexNumber && dexNumber > profile.maxDexNumber) return false;

    return true;
  }
}

const profile = (profile: VanillaGameProfile): VanillaGameProfile => profile;

export const VANILLA_GAME_PROFILES: Record<string, VanillaGameProfile> = {
  vanilla_red_blue_yellow: profile({
    id: 'vanilla_red_blue_yellow',
    label: 'Pokémon Red / Blue / Yellow',
    shortLabel: 'Kanto #001-151',
    game: 'Pokémon Red / Blue / Yellow',
    poolLabel: 'Kanto Pokédex #001-151',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 151 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Red / Blue / Yellow uses a conservative Kanto Pokédex pool. Version-exclusive encounters, trades, and gift availability should become a dedicated data pack later.',
  }),
  vanilla_fire_red: profile({
    id: 'vanilla_fire_red',
    label: 'Pokémon FireRed / LeafGreen',
    shortLabel: 'Kanto #001-151',
    game: 'Pokémon FireRed / LeafGreen',
    poolLabel: 'Kanto Pokédex #001-151',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 151 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'FireRed / LeafGreen currently uses a conservative Kanto Pokédex pool. Post-game trades and encounter-route constraints should become a dedicated data pack later.',
  }),
  vanilla_gold_silver_crystal: profile({
    id: 'vanilla_gold_silver_crystal',
    label: 'Pokémon Gold / Silver / Crystal',
    shortLabel: 'Johto #001-251',
    game: 'Pokémon Gold / Silver / Crystal',
    poolLabel: 'Johto + Kanto Pokédex #001-251',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 251 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Gold / Silver / Crystal uses a conservative Johto + Kanto pool. Version-exclusive and time-gated encounters should become a dedicated data pack later.',
  }),
  vanilla_heartgold_soulsilver: profile({
    id: 'vanilla_heartgold_soulsilver',
    label: 'Pokémon HeartGold / SoulSilver',
    shortLabel: 'Johto + Kanto',
    game: 'Pokémon HeartGold / SoulSilver',
    poolLabel: 'Johto + Kanto story pool #001-251',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 251 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'HeartGold / SoulSilver uses a conservative Johto + Kanto story pool. Safari Zone, swarm, Pokéwalker, and post-game details should become a dedicated data pack later.',
  }),
  vanilla_ruby_sapphire: profile({
    id: 'vanilla_ruby_sapphire',
    label: 'Pokémon Ruby / Sapphire',
    shortLabel: 'Gen III #001-386',
    game: 'Pokémon Ruby / Sapphire',
    poolLabel: 'Generation I-III Pokédex #001-386',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 386 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Ruby / Sapphire uses a conservative Generation I-III pool. Exact Hoenn encounter availability should become a versioned data pack later.',
  }),
  vanilla_emerald: profile({
    id: 'vanilla_emerald',
    label: 'Pokémon Emerald',
    shortLabel: 'Gen III #001-386',
    game: 'Pokémon Emerald',
    poolLabel: 'Generation I-III Pokédex #001-386',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 386 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Emerald currently uses a conservative Generation I-III pool. Exact Hoenn encounter availability should become a versioned data pack later.',
  }),
  vanilla_diamond_pearl: profile({
    id: 'vanilla_diamond_pearl',
    label: 'Pokémon Diamond / Pearl',
    shortLabel: 'Gen IV #001-493',
    game: 'Pokémon Diamond / Pearl',
    poolLabel: 'Generation I-IV Pokédex #001-493',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 493 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Diamond / Pearl uses a conservative Generation I-IV pool. Exact Sinnoh regional and post-game availability should become a dedicated data pack later.',
  }),
  vanilla_platinum: profile({
    id: 'vanilla_platinum',
    label: 'Pokémon Platinum',
    shortLabel: 'Gen IV #001-493',
    game: 'Pokémon Platinum',
    poolLabel: 'Generation I-IV Pokédex #001-493',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 493 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Platinum uses a conservative Generation I-IV pool. Exact Platinum encounter availability should become a versioned data pack later.',
  }),
  vanilla_black_white: profile({
    id: 'vanilla_black_white',
    label: 'Pokémon Black / White',
    shortLabel: 'Unova #494-649',
    game: 'Pokémon Black / White',
    poolLabel: 'Unova story Pokédex #494-649',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 494, to: 649 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Black / White uses the conservative Unova story pool. Post-game National Dex access should become an optional data pack later.',
  }),
  vanilla_black_2_white_2: profile({
    id: 'vanilla_black_2_white_2',
    label: 'Pokémon Black 2 / White 2',
    shortLabel: 'Gen V #001-649',
    game: 'Pokémon Black 2 / White 2',
    poolLabel: 'Generation I-V Pokédex #001-649',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 649 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Black 2 / White 2 uses a conservative Generation I-V pool. Exact expanded Unova encounter availability should become a versioned data pack later.',
  }),
  vanilla_x_y: profile({
    id: 'vanilla_x_y',
    label: 'Pokémon X / Y',
    shortLabel: 'Gen VI #001-721',
    game: 'Pokémon X / Y',
    poolLabel: 'Generation I-VI Pokédex #001-721',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 721 }],
    strictPool: true,
    allowMegas: true,
    allowRegionalForms: false,
    warning: 'X / Y uses a conservative Generation I-VI pool. Exact Kalos regional availability and Mega Stone timing should become a dedicated data pack later.',
  }),
  vanilla_omega_ruby_alpha_sapphire: profile({
    id: 'vanilla_omega_ruby_alpha_sapphire',
    label: 'Pokémon Omega Ruby / Alpha Sapphire',
    shortLabel: 'Gen VI #001-721',
    game: 'Pokémon Omega Ruby / Alpha Sapphire',
    poolLabel: 'Generation I-VI Pokédex #001-721',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 721 }],
    strictPool: true,
    allowMegas: true,
    allowRegionalForms: false,
    warning: 'Omega Ruby / Alpha Sapphire uses a conservative Generation I-VI pool. Exact Hoenn Dex, Mirage Spot, and post-game availability should become a dedicated data pack later.',
  }),
  vanilla_sun_moon: profile({
    id: 'vanilla_sun_moon',
    label: 'Pokémon Sun / Moon',
    shortLabel: 'Gen VII #001-802',
    game: 'Pokémon Sun / Moon',
    poolLabel: 'Generation I-VII Pokédex #001-802',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 802 }],
    strictPool: true,
    allowMegas: true,
    allowRegionalForms: true,
    warning: 'Sun / Moon uses a conservative Generation I-VII pool. Exact Alola encounter availability should become a versioned data pack later.',
  }),
  vanilla_ultra_sun_ultra_moon: profile({
    id: 'vanilla_ultra_sun_ultra_moon',
    label: 'Pokémon Ultra Sun / Ultra Moon',
    shortLabel: 'Gen VII #001-807',
    game: 'Pokémon Ultra Sun / Ultra Moon',
    poolLabel: 'Generation I-VII Pokédex #001-807',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 807 }],
    strictPool: true,
    allowMegas: true,
    allowRegionalForms: true,
    warning: 'Ultra Sun / Ultra Moon uses a conservative Generation I-VII pool. Ultra Space and version-specific encounters should become a dedicated data pack later.',
  }),
  vanilla_lets_go_pikachu_eevee: profile({
    id: 'vanilla_lets_go_pikachu_eevee',
    label: 'Pokémon Let’s Go Pikachu / Eevee',
    shortLabel: 'Kanto + Meltan',
    game: 'Pokémon Let’s Go Pikachu / Eevee',
    poolLabel: 'Kanto Pokédex #001-151 + Meltan/Melmetal',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 151 }],
    allowedDexNumbers: [808, 809],
    strictPool: true,
    allowMegas: true,
    allowRegionalForms: true,
    warning: 'Let’s Go Pikachu / Eevee uses a conservative Kanto + Meltan/Melmetal pool. GO Park and Alolan trade details should become a dedicated data pack later.',
  }),
  vanilla_sword_shield: profile({
    id: 'vanilla_sword_shield',
    label: 'Pokémon Sword / Shield',
    shortLabel: 'Gen VIII #001-898',
    game: 'Pokémon Sword / Shield',
    poolLabel: 'Generation I-VIII Pokédex #001-898',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 898 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: true,
    warning: 'Sword / Shield uses a broad Generation I-VIII pool. Exact Galar, Isle of Armor, Crown Tundra, and transfer availability should become selectable data packs later.',
  }),
  vanilla_brilliant_diamond_shining_pearl: profile({
    id: 'vanilla_brilliant_diamond_shining_pearl',
    label: 'Pokémon Brilliant Diamond / Shining Pearl',
    shortLabel: 'Gen IV #001-493',
    game: 'Pokémon Brilliant Diamond / Shining Pearl',
    poolLabel: 'Generation I-IV Pokédex #001-493',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 493 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: false,
    warning: 'Brilliant Diamond / Shining Pearl uses a conservative Generation I-IV pool. Underground and version-exclusive details should become a dedicated data pack later.',
  }),
  vanilla_legends_arceus: profile({
    id: 'vanilla_legends_arceus',
    label: 'Pokémon Legends: Arceus',
    shortLabel: 'Hisui bootstrap',
    game: 'Pokémon Legends: Arceus',
    poolLabel: 'Hisui Pokédex bootstrap',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 905 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: true,
    warning: 'Legends: Arceus uses a broad Hisui bootstrap. Exact Hisui Pokédex and action-RPG battle constraints should become a dedicated profile later.',
  }),
  vanilla_scarlet_violet: profile({
    id: 'vanilla_scarlet_violet',
    label: 'Pokémon Scarlet / Violet',
    shortLabel: 'Gen IX #001-1025',
    game: 'Pokémon Scarlet / Violet',
    poolLabel: 'Generation I-IX Pokédex #001-1025',
    poolStatus: 'bootstrap',
    allowedDexRanges: [{ from: 1, to: 1025 }],
    strictPool: true,
    allowMegas: false,
    allowRegionalForms: true,
    warning: 'Scarlet / Violet uses a broad Generation I-IX pool. Paldea, Kitakami, Blueberry, transfer, and regulation-specific pools should become selectable data packs later.',
  }),
  vanilla_legends_za: profile({
    id: 'vanilla_legends_za',
    label: 'Pokémon Legends: Z-A',
    shortLabel: 'Lumiose pending',
    game: 'Pokémon Legends: Z-A',
    poolLabel: 'Lumiose Pokédex pending',
    poolStatus: 'pending',
    strictPool: false,
    allowMegas: true,
    allowRegionalForms: true,
    warning: 'Legends: Z-A is available as a game selector option, but its verified final Pokémon pool is not loaded yet. Equinox falls back to generic Vanilla until a versioned data pack exists.',
  }),
};
