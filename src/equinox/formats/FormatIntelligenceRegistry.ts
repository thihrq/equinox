import {
  FormatIntelligenceAnalysis,
  FormatIntelligenceProfile,
} from './FormatIntelligence';
import { VanillaGameProfileRegistry, VANILLA_GAME_PROFILES } from './VanillaGameProfiles';
import { ChampionsRegulationProfileRegistry } from '../champions/ChampionsRegulationData';

const DEFAULT_WEIGHTS = {
  balance: 1,
  meta: 1,
  boss: 0,
  regulation: 0,
  defense: 1,
  speed: 1,
  roles: 1,
  threats: 1,
  consistency: 1,
  worstMatchup: 1,
};

export class FormatIntelligenceRegistry {
  private readonly vanillaGameProfiles = new VanillaGameProfileRegistry();
  private readonly championsRegulations = new ChampionsRegulationProfileRegistry();

  public getProfile(format: string): FormatIntelligenceAnalysis {
    const canonical = this.normalizeFormat(format);
    const profile =
      this.createChampionsRegulationProfile(canonical) ??
      this.profiles[canonical] ??
      this.createVanillaGameProfile(canonical) ??
      this.profiles.vanilla;

    return {
      ...profile,
      normalizedFrom: format || 'vanilla',
      isScenarioAware: profile.mode === 'boss_gauntlet' || profile.mode === 'live_regulation',
      freshnessLabel: this.resolveFreshnessLabel(profile),
    };
  }

  public normalizeFormat(format: string): string {
    const normalized = (format || 'vanilla')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[\/]/g, '_')
      .replace(/-/g, '_');

    const aliases: Record<string, string> = {
      default: 'vanilla',
      generic: 'vanilla',
      vanilla_singles: 'vanilla',
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
      emerald: 'vanilla_emerald',
      pokemon_emerald: 'vanilla_emerald',
      vanilla_emerald: 'vanilla_emerald',
      legends_za: 'vanilla_legends_za',
      legends_z_a: 'vanilla_legends_za',
      pokemon_legends_za: 'vanilla_legends_za',
      pokemon_legends_z_a: 'vanilla_legends_za',
      vanilla_legends_za: 'vanilla_legends_za',
      radicalred: 'radical_red',
      radical_red_hardcore: 'radical_red',
      radical_red_hardmode: 'radical_red',
      radical_red_restricted: 'radical_red',
      rr_hardcore: 'radical_red',
      rr_restricted: 'radical_red',
      rr: 'radical_red',
      natdex: 'national_dex',
      nationaldex: 'national_dex',
      national_dex_singles: 'national_dex',
      champion: 'champions_reg_m_b_singles',
      champions: 'champions_reg_m_b_singles',
      pokemon_champions: 'champions_reg_m_b_singles',
      pokemon_champions_singles: 'champions_reg_m_b_singles',
      champions_single: 'champions_reg_m_b_singles',
      champions_1v1: 'champions_reg_m_b_singles',
      champions_singles: 'champions_reg_m_b_singles',
      champions_ranked_singles: 'champions_reg_m_b_singles',
      champions_m_b_singles: 'champions_reg_m_b_singles',
      champions_reg_m_b_singles: 'champions_reg_m_b_singles',
      champions_regulation_m_b_singles: 'champions_reg_m_b_singles',
      champions_ranked: 'champions_reg_m_b_singles',
      pokemon_champions_ranked: 'champions_reg_m_b_singles',
      pokemon_champions_ranked_singles: 'champions_reg_m_b_singles',
      pokemon_champions_doubles: 'champions_reg_m_b_doubles',
      champions_double: 'champions_reg_m_b_doubles',
      champions_doubles: 'champions_reg_m_b_doubles',
      champions_ranked_doubles: 'champions_reg_m_b_doubles',
      champions_m_b_doubles: 'champions_reg_m_b_doubles',
      champions_reg_m_b_doubles: 'champions_reg_m_b_doubles',
      champions_regulation_m_b_doubles: 'champions_reg_m_b_doubles',
      pokemon_champions_ranked_doubles: 'champions_reg_m_b_doubles',
    };

    const aliased = aliases[normalized] ?? normalized;
    const vanillaCanonical = this.vanillaGameProfiles.normalizeFormat(aliased);

    if (VANILLA_GAME_PROFILES[vanillaCanonical]) {
      return vanillaCanonical;
    }

    const championsCanonical = this.championsRegulations.normalizeFormat(aliased);

    if (this.championsRegulations.getProfile(championsCanonical)) {
      return championsCanonical;
    }

    return aliased;
  }

  public isPokemonChampions(format: string): boolean {
    return this.championsRegulations.isChampionsFormat(this.normalizeFormat(format));
  }

  public isRadicalRed(format: string): boolean {
    return this.normalizeFormat(format) === 'radical_red';
  }

  public isVanillaGame(format: string): boolean {
    return this.vanillaGameProfiles.isGameProfile(this.normalizeFormat(format));
  }

  private createChampionsRegulationProfile(canonical: string): FormatIntelligenceProfile | undefined {
    const regulation = this.championsRegulations.getProfile(canonical);

    if (!regulation) return undefined;

    return {
      id: regulation.id,
      label: regulation.label,
      gameFamily: 'pokemon_champions',
      mode: 'live_regulation',
      battleStyle: regulation.battleStyle,
      engineStrategy: regulation.battleStyle === 'doubles'
        ? 'Pokémon Champions Regulation Doubles Engine'
        : 'Pokémon Champions Regulation Singles Engine',
      description: `${regulation.label} profile for ${regulation.mode} ${regulation.battleStyle}. The recommendation is optimized against the current season, key regulation threats, Mega Evolution availability, and ${regulation.battleStyle === 'doubles' ? 'board-control requirements' : 'speed-control requirements'}.`,
      sourceName: regulation.sourceName,
      sourceUrl: regulation.sourceUrl,
      sourceUpdatedAt: regulation.startDate,
      dataVersion: regulation.dataVersion,
      dataStatus: regulation.dataStatus,
      fallbackFormat: 'national_dex',
      usesMeta: true,
      usesBossData: false,
      usesRegulationData: true,
      warning: regulation.warnings[0],
      uiTags: regulation.uiTags,
      weights: {
        ...DEFAULT_WEIGHTS,
        balance: regulation.battleStyle === 'doubles' ? 0.75 : 0.95,
        meta: 1.1,
        regulation: 1.8,
        defense: regulation.battleStyle === 'doubles' ? 0.95 : 1.05,
        speed: 1.25,
        roles: regulation.battleStyle === 'doubles' ? 1.35 : 1.1,
        threats: 1.3,
        consistency: 1.45,
        worstMatchup: 1.25,
      },
    };
  }

  private createVanillaGameProfile(canonical: string): FormatIntelligenceProfile | undefined {
    const vanillaGame = VANILLA_GAME_PROFILES[canonical];

    if (!vanillaGame) return undefined;

    return {
      id: vanillaGame.id,
      label: vanillaGame.label,
      gameFamily: 'core',
      mode: 'generic_balance',
      battleStyle: 'singles',
      engineStrategy: 'Game-aware Vanilla Pool Engine',
      description: `${vanillaGame.game} profile using ${vanillaGame.poolLabel}. It keeps Vanilla battle assumptions while restricting candidates, threat intelligence, and matchup analysis to the selected game pool.`,
      sourceName: vanillaGame.poolLabel,
      dataVersion: `${vanillaGame.id}-pool-v1`,
      dataStatus: vanillaGame.poolStatus === 'pending' ? 'unknown' : 'community',
      fallbackFormat: 'vanilla',
      usesMeta: false,
      usesBossData: false,
      usesRegulationData: false,
      warning: vanillaGame.warning,
      uiTags: ['vanilla', 'game pool', vanillaGame.shortLabel],
      weights: DEFAULT_WEIGHTS,
    };
  }

  private resolveFreshnessLabel(profile: FormatIntelligenceProfile): string {
    switch (profile.dataStatus) {
      case 'verified':
        return 'Verified data';
      case 'community':
        return 'Community data';
      case 'outdated':
        return 'Outdated data';
      case 'unknown':
      default:
        return 'Needs data verification';
    }
  }

  private readonly profiles: Record<string, FormatIntelligenceProfile> = {
    vanilla: {
      id: 'vanilla',
      label: 'Vanilla Singles',
      gameFamily: 'core',
      mode: 'generic_balance',
      battleStyle: 'singles',
      engineStrategy: 'Generic Team Balance Engine',
      description: 'Generic singles balance profile for broad team-synergy checks without binding the result to a ladder, boss gauntlet, or live regulation.',
      sourceName: 'Equinox built-in baseline',
      dataVersion: '1.0.0-rc',
      dataStatus: 'verified',
      fallbackFormat: 'vanilla',
      usesMeta: true,
      usesBossData: false,
      usesRegulationData: false,
      uiTags: ['generic', 'singles', 'baseline'],
      weights: DEFAULT_WEIGHTS,
    },
    national_dex: {
      id: 'national_dex',
      label: 'National Dex',
      gameFamily: 'smogon',
      mode: 'meta_ladder',
      battleStyle: 'singles',
      engineStrategy: 'Meta Ladder Engine',
      description: 'Expanded singles profile for broad ladder-style threats, Megas, and high-pressure offensive cores.',
      sourceName: 'Equinox curated ladder baseline',
      dataVersion: '1.0.0-rc',
      dataStatus: 'community',
      fallbackFormat: 'vanilla',
      usesMeta: true,
      usesBossData: false,
      usesRegulationData: false,
      uiTags: ['meta', 'singles', 'ladder'],
      weights: {
        ...DEFAULT_WEIGHTS,
        meta: 1.25,
        speed: 1.1,
        threats: 1.15,
      },
    },
    radical_red: {
      id: 'radical_red',
      label: 'Radical Red 4.1 Hardcore Boss Gauntlet',
      gameFamily: 'radical_red',
      mode: 'boss_gauntlet',
      battleStyle: 'gauntlet',
      engineStrategy: 'Radical Red Boss Gauntlet Engine',
      description: 'Scenario-aware profile for Radical Red Hardcore / Restricted Mode. The recommendation is optimized against the Indigo League sequence: Lorelei, Bruno, Agatha, Lance, and Champion/Rival branches using official Drive boss documentation.',
      sourceName: 'Radical Red Official Docs Drive / Restricted-Hardcore Mode Boss Trainers Teams',
      sourceUrl: 'https://docs.google.com/spreadsheets/d/1jDbKFA30xo8csPHZNLtsmqs781bW_Xb9mKoPYyE6KK8/edit?usp=drive_link',
      sourceUpdatedAt: '2024-03-22',
      dataVersion: 'rr-4.1-hardcore-indigo-v1',
      dataStatus: 'verified',
      fallbackFormat: 'radical_red',
      usesMeta: false,
      usesBossData: true,
      usesRegulationData: false,
      warning: 'Radical Red 4.1 Hardcore / Restricted Indigo League data pack loaded from the official documentation Drive. Revalidate after Radical Red updates; Normal Mode is intentionally not used for this builder profile.',
      uiTags: ['boss gauntlet', 'radical red 4.1', 'hardcore mode', 'restricted mode', 'elite four', 'champion'],
      weights: {
        ...DEFAULT_WEIGHTS,
        balance: 0.75,
        meta: 0.15,
        boss: 1.75,
        defense: 1.25,
        speed: 1.2,
        threats: 1.35,
        consistency: 1.55,
        worstMatchup: 1.8,
      },
    },
    champions_singles: {
      id: 'champions_singles',
      label: 'Pokémon Champions Singles',
      gameFamily: 'pokemon_champions',
      mode: 'live_regulation',
      battleStyle: 'singles',
      engineStrategy: 'Live Regulation Ladder Engine',
      description: 'Profile reserved for Pokémon Champions Single Battles. It is regulation-aware and should evolve with seasons, allowed Pokémon, items, and mechanics.',
      sourceName: 'Pokémon Champions regulation profile pending publication',
      dataVersion: 'bootstrap',
      dataStatus: 'unknown',
      fallbackFormat: 'vanilla',
      usesMeta: true,
      usesBossData: false,
      usesRegulationData: true,
      warning: 'No verified Pokémon Champions regulation data pack is loaded yet. Equinox uses a conservative singles ladder bootstrap until official season data is added.',
      uiTags: ['champions', 'singles', 'live regulation'],
      weights: {
        ...DEFAULT_WEIGHTS,
        meta: 1.15,
        regulation: 1.45,
        speed: 1.2,
        threats: 1.2,
        consistency: 1.25,
      },
    },
    champions_ranked_singles: {
      id: 'champions_ranked_singles',
      label: 'Pokémon Champions Ranked Singles',
      gameFamily: 'pokemon_champions',
      mode: 'live_regulation',
      battleStyle: 'singles',
      engineStrategy: 'Live Regulation Ladder Engine',
      description: 'Ranked-focused Pokémon Champions singles profile. It should be bound to a specific regulation set once official season data is available.',
      sourceName: 'Pokémon Champions ranked regulation profile pending publication',
      dataVersion: 'bootstrap',
      dataStatus: 'unknown',
      fallbackFormat: 'vanilla',
      usesMeta: true,
      usesBossData: false,
      usesRegulationData: true,
      warning: 'Ranked regulation data is not loaded yet. Current analysis is a bootstrap profile, not a final season-specific recommendation.',
      uiTags: ['champions', 'ranked', 'singles'],
      weights: {
        ...DEFAULT_WEIGHTS,
        meta: 1.2,
        regulation: 1.55,
        speed: 1.25,
        threats: 1.25,
        consistency: 1.3,
      },
    },
    champions_doubles: {
      id: 'champions_doubles',
      label: 'Pokémon Champions Doubles',
      gameFamily: 'pokemon_champions',
      mode: 'live_regulation',
      battleStyle: 'doubles',
      engineStrategy: 'Live Regulation Doubles Engine',
      description: 'Profile reserved for Pokémon Champions Double Battles, valuing lead pairs, tempo, speed control, field pressure, and role compression.',
      sourceName: 'Pokémon Champions doubles regulation profile pending publication',
      dataVersion: 'bootstrap',
      dataStatus: 'unknown',
      fallbackFormat: 'vanilla',
      usesMeta: true,
      usesBossData: false,
      usesRegulationData: true,
      warning: 'No verified Pokémon Champions doubles regulation data pack is loaded yet. Current output is a doubles-oriented bootstrap, not a season-locked answer.',
      uiTags: ['champions', 'doubles', 'field control'],
      weights: {
        ...DEFAULT_WEIGHTS,
        meta: 1.1,
        regulation: 1.45,
        roles: 1.2,
        speed: 1.25,
        threats: 1.15,
        consistency: 1.25,
      },
    },
    champions_ranked_doubles: {
      id: 'champions_ranked_doubles',
      label: 'Pokémon Champions Ranked Doubles',
      gameFamily: 'pokemon_champions',
      mode: 'live_regulation',
      battleStyle: 'doubles',
      engineStrategy: 'Live Regulation Doubles Engine',
      description: 'Ranked-focused Pokémon Champions doubles profile for season-specific ladder analysis once regulation data is available.',
      sourceName: 'Pokémon Champions ranked doubles profile pending publication',
      dataVersion: 'bootstrap',
      dataStatus: 'unknown',
      fallbackFormat: 'vanilla',
      usesMeta: true,
      usesBossData: false,
      usesRegulationData: true,
      warning: 'Ranked doubles regulation data is not loaded yet. Current analysis uses a conservative doubles bootstrap.',
      uiTags: ['champions', 'ranked', 'doubles'],
      weights: {
        ...DEFAULT_WEIGHTS,
        meta: 1.15,
        regulation: 1.55,
        roles: 1.25,
        speed: 1.3,
        threats: 1.2,
        consistency: 1.35,
      },
    },
  };
}
