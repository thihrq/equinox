import { MetaFormat, MetaFormatId } from './MetaFormat';
import { Threat } from '../threats/Threat';
import { FormatIntelligenceRegistry } from '../formats/FormatIntelligenceRegistry';
import { VanillaGameProfile, VanillaGameProfileRegistry } from '../formats/VanillaGameProfiles';
import { ChampionsRegulationProfileRegistry } from '../champions/ChampionsRegulationData';

export class MetaDatabase {
  private readonly formatRegistry = new FormatIntelligenceRegistry();
  private readonly vanillaProfiles = new VanillaGameProfileRegistry();
  private readonly championsProfiles = new ChampionsRegulationProfileRegistry();

  public getFormat(format: string): MetaFormat {
    const canonical = this.formatRegistry.normalizeFormat(format);
    const vanillaProfile = this.vanillaProfiles.getProfile(canonical);

    if (vanillaProfile) {
      return this.getVanillaGameMeta(canonical, vanillaProfile);
    }

    const normalized = this.normalizeFormat(canonical);

    switch (normalized) {
      case 'radical_red':
        return this.getRadicalRedMeta();
      case 'national_dex':
        return this.getNationalDexMeta();
      case 'champions_singles':
      case 'champions_ranked_singles':
      case 'champions_reg_m_b_singles':
        return this.getChampionsSinglesMeta(normalized);
      case 'champions_doubles':
      case 'champions_ranked_doubles':
      case 'champions_reg_m_b_doubles':
        return this.getChampionsDoublesMeta(normalized);
      case 'vanilla':
      default:
        return this.getVanillaMeta();
    }
  }

  private normalizeFormat(format: string): MetaFormatId {
    const normalized = this.formatRegistry.normalizeFormat(format);

    if (
      normalized === 'radical_red' ||
      normalized === 'national_dex' ||
      normalized === 'champions_singles' ||
      normalized === 'champions_ranked_singles' ||
      normalized === 'champions_doubles' ||
      normalized === 'champions_ranked_doubles' ||
      normalized === 'champions_reg_m_b_singles' ||
      normalized === 'champions_reg_m_b_doubles'
    ) {
      return normalized;
    }

    return 'vanilla';
  }

  private getVanillaMeta(): MetaFormat {
    return {
      id: 'vanilla',
      name: 'Vanilla Singles',
      description: 'Perfil genérico para batalhas singles, usando ameaças competitivas amplas como referência inicial.',
      threatProfileName: 'Generic Singles Threat Profile',
      threats: this.getGenericSinglesThreats(),
      weights: {
        coverage: 1,
        defense: 1,
        roles: 1,
        speed: 1,
        threats: 1,
      },
      notes: [
        'Usa ameaças amplas de singles como referência inicial.',
        'Ideal para validar sinergia geral sem prender a análise a uma tier específica.',
      ],
    };
  }


  private getVanillaGameMeta(canonical: string, profile: VanillaGameProfile): MetaFormat {
    const threats = this.getVanillaGameThreats(canonical);

    return {
      id: 'vanilla',
      name: profile.label,
      description: `${profile.label} usa um perfil Vanilla com escopo de jogo: a recomendação e a análise de ameaças respeitam ${profile.poolLabel}, sem misturar ameaças de ladder moderna.`,
      threatProfileName: `${profile.game} Game Pool Threat Profile`,
      threats,
      weights: {
        coverage: 1,
        defense: 1,
        roles: 0.95,
        speed: 0.9,
        threats: 0.65,
      },
      notes: [
        `Pool ativo: ${profile.poolLabel}.`,
        'Ameaças e matchups são limitados ao escopo do jogo selecionado, não ao meta moderno de Smogon, National Dex ou Pokémon Champions.',
        profile.warning ?? 'Perfil Vanilla com pool conservador; dados por rota, versão e pós-game devem entrar em data packs dedicados.',
      ],
    };
  }

  private getVanillaGameThreats(canonical: string): Threat[] {
    const threat = (
      name: string,
      types: string[],
      category: Threat['category'],
      baseSpeed: number,
      importance: number,
      tags: string[],
    ): Threat => ({
      name,
      types,
      category,
      baseSpeed,
      importance,
      tags: ['Game Pool Threat', ...tags],
    });

    const kanto = (): Threat[] => [
      threat('Dragonite', ['Dragon', 'Flying'], 'Physical', 80, 92, ['Late Game', 'Dragon', 'Elite Four Style']),
      threat('Snorlax', ['Normal'], 'Physical', 30, 91, ['Bulky Wallbreaker', 'Endurance']),
      threat('Lapras', ['Water', 'Ice'], 'Special', 60, 88, ['Water/Ice Coverage', 'Bulky Special']),
      threat('Alakazam', ['Psychic'], 'Special', 120, 88, ['Fast Special Pressure']),
      threat('Gengar', ['Ghost', 'Poison'], 'Special', 110, 87, ['Fast Utility', 'Special Pressure']),
      threat('Starmie', ['Water', 'Psychic'], 'Special', 115, 86, ['Fast Special Pressure', 'Coverage']),
      threat('Gyarados', ['Water', 'Flying'], 'Physical', 81, 85, ['Setup Pressure', 'Intimidate Style']),
      threat('Aerodactyl', ['Rock', 'Flying'], 'Physical', 130, 84, ['Fast Physical Pressure']),
      threat('Machamp', ['Fighting'], 'Physical', 55, 82, ['Physical Breaker']),
      threat('Exeggutor', ['Grass', 'Psychic'], 'Special', 55, 80, ['Status', 'Bulky Special']),
      threat('Jolteon', ['Electric'], 'Special', 130, 79, ['Fast Electric Pressure']),
      threat('Charizard', ['Fire', 'Flying'], 'Mixed', 100, 78, ['Starter', 'Mixed Coverage']),
    ];

    const johto = (): Threat[] => [
      threat('Tyranitar', ['Rock', 'Dark'], 'Physical', 61, 94, ['Pseudo Legendary', 'Bulky Breaker']),
      threat('Dragonite', ['Dragon', 'Flying'], 'Physical', 80, 91, ['Late Game', 'Dragon']),
      threat('Snorlax', ['Normal'], 'Physical', 30, 90, ['Bulky Wallbreaker']),
      threat('Gengar', ['Ghost', 'Poison'], 'Special', 110, 88, ['Fast Utility']),
      threat('Alakazam', ['Psychic'], 'Special', 120, 87, ['Fast Special Pressure']),
      threat('Heracross', ['Bug', 'Fighting'], 'Physical', 85, 86, ['Physical Breaker']),
      threat('Skarmory', ['Steel', 'Flying'], 'Physical', 70, 84, ['Physical Wall', 'Steel/Flying']),
      threat('Kingdra', ['Water', 'Dragon'], 'Mixed', 85, 83, ['Water/Dragon Coverage']),
      threat('Espeon', ['Psychic'], 'Special', 110, 80, ['Fast Special Pressure']),
      threat('Jolteon', ['Electric'], 'Special', 130, 79, ['Fast Electric Pressure']),
    ];

    const hoenn = (): Threat[] => [
      threat('Salamence', ['Dragon', 'Flying'], 'Physical', 100, 95, ['Pseudo Legendary', 'Physical Pressure']),
      threat('Metagross', ['Steel', 'Psychic'], 'Physical', 70, 94, ['Pseudo Legendary', 'Steel Check']),
      threat('Milotic', ['Water'], 'Special', 81, 90, ['Bulky Water', 'Endurance']),
      threat('Swampert', ['Water', 'Ground'], 'Physical', 60, 89, ['Bulky Water/Ground']),
      threat('Gardevoir', ['Psychic'], 'Special', 80, 86, ['Special Pressure']),
      threat('Flygon', ['Ground', 'Dragon'], 'Physical', 100, 85, ['Ground/Dragon Coverage']),
      threat('Blaziken', ['Fire', 'Fighting'], 'Mixed', 80, 84, ['Starter', 'Mixed Breaker']),
      threat('Sceptile', ['Grass'], 'Special', 120, 83, ['Fast Grass Pressure']),
      threat('Gengar', ['Ghost', 'Poison'], 'Special', 110, 82, ['Fast Special Utility']),
      threat('Starmie', ['Water', 'Psychic'], 'Special', 115, 81, ['Fast Special Coverage']),
      threat('Snorlax', ['Normal'], 'Physical', 30, 80, ['Bulky Wallbreaker']),
      threat('Aerodactyl', ['Rock', 'Flying'], 'Physical', 130, 79, ['Fast Physical Pressure']),
    ];

    const sinnoh = (): Threat[] => [
      threat('Garchomp', ['Dragon', 'Ground'], 'Physical', 102, 96, ['Pseudo Legendary', 'Physical Pressure']),
      threat('Lucario', ['Fighting', 'Steel'], 'Physical', 90, 91, ['Setup Sweeper', 'Steel/Fighting']),
      threat('Togekiss', ['Normal', 'Flying'], 'Special', 80, 88, ['Bulky Special', 'Flinch Pressure']),
      threat('Infernape', ['Fire', 'Fighting'], 'Mixed', 108, 87, ['Fast Mixed Pressure']),
      threat('Gengar', ['Ghost', 'Poison'], 'Special', 110, 86, ['Fast Special Utility']),
      threat('Tyranitar', ['Rock', 'Dark'], 'Physical', 61, 85, ['Bulky Breaker']),
      threat('Milotic', ['Water'], 'Special', 81, 84, ['Bulky Water']),
      threat('Roserade', ['Grass', 'Poison'], 'Special', 90, 82, ['Special Pressure', 'Status']),
      threat('Weavile', ['Dark', 'Ice'], 'Physical', 125, 81, ['Fast Physical Pressure']),
      threat('Magnezone', ['Electric', 'Steel'], 'Special', 60, 80, ['Steel/Electric Pressure']),
    ];

    const unovaStory = (): Threat[] => [
      threat('Hydreigon', ['Dark', 'Dragon'], 'Special', 98, 95, ['Pseudo Legendary', 'Special Breaker']),
      threat('Volcarona', ['Bug', 'Fire'], 'Special', 100, 93, ['Setup Sweeper', 'Special Pressure']),
      threat('Haxorus', ['Dragon'], 'Physical', 97, 91, ['Physical Breaker']),
      threat('Excadrill', ['Ground', 'Steel'], 'Physical', 88, 90, ['Ground/Steel Pressure']),
      threat('Conkeldurr', ['Fighting'], 'Physical', 45, 88, ['Bulky Physical Breaker']),
      threat('Chandelure', ['Ghost', 'Fire'], 'Special', 80, 86, ['Special Breaker']),
      threat('Krookodile', ['Ground', 'Dark'], 'Physical', 92, 85, ['Ground/Dark Pressure']),
      threat('Ferrothorn', ['Grass', 'Steel'], 'Physical', 20, 84, ['Bulky Steel', 'Hazard Style']),
      threat('Jellicent', ['Water', 'Ghost'], 'Special', 60, 82, ['Bulky Water/Ghost']),
      threat('Mienshao', ['Fighting'], 'Physical', 105, 80, ['Fast Physical Pressure']),
    ];

    const kalos = (): Threat[] => [
      threat('Aegislash', ['Steel', 'Ghost'], 'Mixed', 60, 95, ['Stance Pressure', 'Steel/Ghost']),
      threat('Greninja', ['Water', 'Dark'], 'Special', 122, 93, ['Fast Special Pressure']),
      threat('Talonflame', ['Fire', 'Flying'], 'Physical', 126, 90, ['Priority Style', 'Fast Pressure']),
      threat('Garchomp', ['Dragon', 'Ground'], 'Physical', 102, 89, ['Physical Pressure']),
      threat('Charizard-Mega-X', ['Fire', 'Dragon'], 'Physical', 100, 88, ['Mega', 'Setup Pressure']),
      threat('Charizard-Mega-Y', ['Fire', 'Flying'], 'Special', 100, 88, ['Mega', 'Sun Pressure']),
      threat('Mawile-Mega', ['Steel', 'Fairy'], 'Physical', 50, 86, ['Mega', 'Physical Breaker']),
      threat('Gardevoir-Mega', ['Psychic', 'Fairy'], 'Special', 100, 84, ['Mega', 'Special Breaker']),
      threat('Tyranitar', ['Rock', 'Dark'], 'Physical', 61, 83, ['Bulky Breaker']),
      threat('Rotom-Wash', ['Electric', 'Water'], 'Special', 86, 82, ['Pivot', 'Defensive Utility']),
    ];

    const alola = (): Threat[] => [
      threat('Kommo-o', ['Dragon', 'Fighting'], 'Mixed', 85, 91, ['Dragon/Fighting Pressure']),
      threat('Mimikyu', ['Ghost', 'Fairy'], 'Physical', 96, 90, ['Setup Pressure', 'Ghost/Fairy']),
      threat('Golisopod', ['Bug', 'Water'], 'Physical', 40, 86, ['Priority Style', 'Bulky Physical']),
      threat('Salamence', ['Dragon', 'Flying'], 'Physical', 100, 85, ['Physical Pressure']),
      threat('Metagross', ['Steel', 'Psychic'], 'Physical', 70, 84, ['Steel Pressure']),
      threat('Garchomp', ['Dragon', 'Ground'], 'Physical', 102, 83, ['Ground/Dragon Pressure']),
      threat('Greninja', ['Water', 'Dark'], 'Special', 122, 82, ['Fast Special Pressure']),
      threat('Toxapex', ['Water', 'Poison'], 'Physical', 35, 81, ['Defensive Anchor']),
      threat('Aegislash', ['Steel', 'Ghost'], 'Mixed', 60, 80, ['Steel/Ghost Pressure']),
    ];

    const galar = (): Threat[] => [
      threat('Dragapult', ['Dragon', 'Ghost'], 'Mixed', 142, 96, ['Fast Mixed Pressure']),
      threat('Corviknight', ['Flying', 'Steel'], 'Physical', 67, 91, ['Defensive Pivot']),
      threat('Grimmsnarl', ['Dark', 'Fairy'], 'Physical', 60, 88, ['Support', 'Dark/Fairy']),
      threat('Cinderace', ['Fire'], 'Physical', 119, 87, ['Fast Physical Pressure']),
      threat('Rillaboom', ['Grass'], 'Physical', 85, 86, ['Physical Pressure', 'Priority Style']),
      threat('Toxtricity', ['Electric', 'Poison'], 'Special', 75, 84, ['Special Pressure']),
      threat('Duraludon', ['Steel', 'Dragon'], 'Special', 85, 83, ['Steel/Dragon Pressure']),
      threat('Tyranitar', ['Rock', 'Dark'], 'Physical', 61, 82, ['Bulky Breaker']),
      threat('Gyarados', ['Water', 'Flying'], 'Physical', 81, 81, ['Setup Pressure']),
    ];

    const hisui = (): Threat[] => [
      threat('Ursaluna', ['Ground', 'Normal'], 'Physical', 50, 94, ['Bulky Physical Breaker']),
      threat('Goodra-Hisui', ['Steel', 'Dragon'], 'Special', 60, 91, ['Bulky Steel/Dragon']),
      threat('Zoroark-Hisui', ['Normal', 'Ghost'], 'Special', 110, 90, ['Fast Special Pressure']),
      threat('Arcanine-Hisui', ['Fire', 'Rock'], 'Physical', 90, 87, ['Physical Pressure']),
      threat('Sneasler', ['Fighting', 'Poison'], 'Physical', 120, 86, ['Fast Physical Pressure']),
      threat('Basculegion', ['Water', 'Ghost'], 'Physical', 78, 84, ['Water/Ghost Pressure']),
      threat('Decidueye-Hisui', ['Grass', 'Fighting'], 'Physical', 60, 82, ['Physical Breaker']),
      threat('Typhlosion-Hisui', ['Fire', 'Ghost'], 'Special', 95, 81, ['Special Pressure']),
    ];

    const paldea = (): Threat[] => [
      threat('Kingambit', ['Dark', 'Steel'], 'Physical', 50, 95, ['Late Game', 'Priority']),
      threat('Great Tusk', ['Ground', 'Fighting'], 'Physical', 87, 94, ['Physical Pressure', 'Hazard Style']),
      threat('Gholdengo', ['Steel', 'Ghost'], 'Special', 84, 92, ['Special Pressure', 'Steel/Ghost']),
      threat('Roaring Moon', ['Dragon', 'Dark'], 'Physical', 119, 91, ['Fast Physical Pressure']),
      threat('Iron Valiant', ['Fairy', 'Fighting'], 'Mixed', 116, 90, ['Mixed Pressure']),
      threat('Walking Wake', ['Water', 'Dragon'], 'Special', 109, 88, ['Special Pressure']),
      threat('Meowscarada', ['Grass', 'Dark'], 'Physical', 123, 86, ['Fast Physical Pressure']),
      threat('Annihilape', ['Fighting', 'Ghost'], 'Physical', 90, 85, ['Bulky Physical Pressure']),
      threat('Skeledirge', ['Fire', 'Ghost'], 'Special', 66, 83, ['Bulky Special Pressure']),
      threat('Baxcalibur', ['Dragon', 'Ice'], 'Physical', 87, 82, ['Physical Breaker']),
    ];

    const map: Record<string, () => Threat[]> = {
      vanilla_red_blue_yellow: kanto,
      vanilla_fire_red: kanto,
      vanilla_lets_go_pikachu_eevee: kanto,
      vanilla_gold_silver_crystal: johto,
      vanilla_heartgold_soulsilver: johto,
      vanilla_ruby_sapphire: hoenn,
      vanilla_emerald: hoenn,
      vanilla_diamond_pearl: sinnoh,
      vanilla_platinum: sinnoh,
      vanilla_brilliant_diamond_shining_pearl: sinnoh,
      vanilla_black_white: unovaStory,
      vanilla_black_2_white_2: unovaStory,
      vanilla_x_y: kalos,
      vanilla_omega_ruby_alpha_sapphire: kalos,
      vanilla_sun_moon: alola,
      vanilla_ultra_sun_ultra_moon: alola,
      vanilla_sword_shield: galar,
      vanilla_legends_arceus: hisui,
      vanilla_scarlet_violet: paldea,
    };

    return (map[canonical] ?? kanto)();
  }

  private getNationalDexMeta(): MetaFormat {
    return {
      id: 'national_dex',
      name: 'National Dex',
      description: 'Perfil expandido para formatos com maior variedade de formas, Megas e ameaças ofensivas.',
      threatProfileName: 'National Dex Threat Profile',
      threats: [
        ...this.getGenericSinglesThreats(),
        {
          name: 'Charizard-Mega-Y',
          importance: 88,
          types: ['Fire', 'Flying'],
          category: 'Special',
          baseSpeed: 100,
          tags: ['Mega', 'Weather Setter', 'Special Breaker'],
        },
        {
          name: 'Lopunny-Mega',
          importance: 86,
          types: ['Normal', 'Fighting'],
          category: 'Physical',
          baseSpeed: 135,
          tags: ['Mega', 'Speed Control', 'Physical Pressure'],
        },
      ],
      weights: {
        coverage: 1,
        defense: 1,
        roles: 1,
        speed: 1.1,
        threats: 1.1,
      },
      notes: [
        'Considera maior pressão de Megas e ameaças rápidas.',
        'Valoriza controle de velocidade e respostas defensivas consistentes.',
      ],
    };
  }

  private getRadicalRedMeta(): MetaFormat {
    return {
      id: 'radical_red',
      name: 'Radical Red 4.1 Hardcore Boss Gauntlet',
      description: 'Perfil de Radical Red 4.1 Hardcore / Restricted focado na sequência da Elite Four e Champion. A leitura principal vem do RadicalRedBossGauntletEngine, não de um meta genérico.',
      threatProfileName: 'Radical Red 4.1 Indigo League Boss Threats',
      threats: [
        {
          name: 'Kyogre-Primal',
          importance: 99,
          types: ['Water'],
          category: 'Special',
          baseSpeed: 90,
          tags: ['Legendary', 'Weather', 'Boss Threat'],
        },
        {
          name: 'Iron Bundle',
          importance: 97,
          types: ['Ice', 'Water'],
          category: 'Special',
          baseSpeed: 136,
          tags: ['Speed Control', 'Special Breaker', 'Boss Threat'],
        },
        {
          name: 'Zacian-Crowned',
          importance: 100,
          types: ['Fairy', 'Steel'],
          category: 'Physical',
          baseSpeed: 148,
          tags: ['Legendary', 'Physical Sweeper', 'Boss Threat'],
        },
        {
          name: 'Marshadow',
          importance: 97,
          types: ['Fighting', 'Ghost'],
          category: 'Physical',
          baseSpeed: 125,
          tags: ['Priority', 'Physical Breaker', 'Boss Threat'],
        },
        {
          name: 'Gengar-Mega',
          importance: 98,
          types: ['Ghost', 'Poison'],
          category: 'Special',
          baseSpeed: 130,
          tags: ['Shadow Tag', 'Special Sweeper', 'Boss Threat'],
        },
        {
          name: 'Dialga-Primal',
          importance: 99,
          types: ['Steel', 'Dragon'],
          category: 'Mixed',
          baseSpeed: 90,
          tags: ['Legendary', 'Mixed Breaker', 'Boss Threat'],
        },
        {
          name: 'Salamence-Mega',
          importance: 97,
          types: ['Dragon', 'Flying'],
          category: 'Physical',
          baseSpeed: 120,
          tags: ['Mega', 'Setup Sweeper', 'Boss Threat'],
        },
        {
          name: 'Koraidon',
          importance: 100,
          types: ['Fighting', 'Dragon'],
          category: 'Physical',
          baseSpeed: 135,
          tags: ['Legendary', 'Weather Setter', 'Physical Breaker', 'Boss Threat'],
        },
        {
          name: 'Miraidon',
          importance: 100,
          types: ['Electric', 'Dragon'],
          category: 'Special',
          baseSpeed: 135,
          tags: ['Legendary', 'Electric Terrain', 'Special Breaker', 'Boss Threat'],
        },
        {
          name: 'Eternatus',
          importance: 99,
          types: ['Poison', 'Dragon'],
          category: 'Special',
          baseSpeed: 130,
          tags: ['Legendary', 'Special Breaker', 'Boss Threat'],
        },
        {
          name: 'Ditto',
          importance: 95,
          types: ['Normal'],
          category: 'Mixed',
          baseSpeed: 48,
          tags: ['Imposter', 'Choice Scarf', 'Reverse Sweep', 'Boss Threat'],
        },
      ],
      weights: {
        coverage: 1,
        defense: 1.3,
        roles: 1.1,
        speed: 1.2,
        threats: 1.45,
      },
      notes: [
        'Formato marcado como Boss Gauntlet pelo Format Intelligence Layer.',
        'O pacote Radical Red 4.1 Hardcore / Restricted Indigo League está carregado e será avaliado pelo RadicalRedBossGauntletEngine.',
        'Esta lista de ameaças serve como fallback/resumo; a decisão principal considera boss, variante, pior linha e ameaças críticas.',
      ],
    };
  }

  private toThreat(threat: {
    name: string;
    importance: number;
    types: string[];
    category: string;
    baseSpeed: number;
    tags: string[];
  }): Threat {
    const category = threat.category === 'Physical' || threat.category === 'Special'
      ? threat.category
      : 'Mixed';

    return {
      name: threat.name,
      importance: threat.importance,
      types: threat.types,
      category,
      baseSpeed: threat.baseSpeed,
      tags: threat.tags,
    };
  }

  private getChampionsSinglesMeta(id: 'champions_singles' | 'champions_ranked_singles' | 'champions_reg_m_b_singles'): MetaFormat {
    const profile = this.championsProfiles.getProfile(id);
    const threats = profile?.keyThreats.map(threat => this.toThreat(threat)) ?? this.getChampionsSinglesThreats();

    return {
      id,
      name: profile?.label ?? (id === 'champions_reg_m_b_singles'
        ? 'Pokémon Champions Regulation M-B Singles'
        : id === 'champions_ranked_singles'
          ? 'Pokémon Champions Ranked Singles Bootstrap'
          : 'Pokémon Champions Singles Bootstrap'),
      description: profile
        ? `${profile.label} usa ameaças-chave do Regulation Profile/Meta Source Pack ativo, sem cair no perfil genérico de Vanilla ou National Dex.`
        : 'Perfil inicial para Pokémon Champions Single Battles. Deve ser substituído por perfis de Regulation/Season assim que os dados oficiais estiverem disponíveis.',
      threatProfileName: profile ? `${profile.shortLabel} Source-Aware Singles Threats` : 'Champions Singles Bootstrap Threats',
      threats,
      weights: {
        coverage: 1.05,
        defense: 1,
        roles: 1,
        speed: 1.2,
        threats: 1.2,
      },
      notes: [
        'Formato marcado como Live Regulation pelo Format Intelligence Layer.',
        profile
          ? `Ameaças vindas do perfil ${profile.dataVersion}; roster lock completo ainda depende do import de Pokémon elegíveis.`
          : 'Usa uma leitura conservadora de ladder singles enquanto não houver regulation set verificado.',
        'Não deve ser tratado como Vanilla puro, pois Champions é um ambiente competitivo vivo.',
      ],
    };
  }

  private getChampionsDoublesMeta(id: 'champions_doubles' | 'champions_ranked_doubles' | 'champions_reg_m_b_doubles'): MetaFormat {
    const profile = this.championsProfiles.getProfile(id);
    const threats = profile?.keyThreats.map(threat => this.toThreat(threat)) ?? this.getChampionsDoublesThreats();

    return {
      id,
      name: profile?.label ?? (id === 'champions_reg_m_b_doubles'
        ? 'Pokémon Champions Regulation M-B Doubles'
        : id === 'champions_ranked_doubles'
          ? 'Pokémon Champions Ranked Doubles Bootstrap'
          : 'Pokémon Champions Doubles Bootstrap'),
      description: profile
        ? `${profile.label} usa ameaças-chave e prioridades de Doubles do Regulation Profile/Meta Source Pack ativo, não uma lista genérica de singles.`
        : 'Perfil inicial para Pokémon Champions Double Battles. Valoriza velocidade, controle de campo, pressão de leads e compressão de funções.',
      threatProfileName: profile ? `${profile.shortLabel} Source-Aware Doubles Threats` : 'Champions Doubles Bootstrap Threats',
      threats,
      weights: {
        coverage: 1,
        defense: 1.05,
        roles: 1.2,
        speed: 1.25,
        threats: 1.15,
      },
      notes: [
        'Formato marcado como Live Regulation pelo Format Intelligence Layer.',
        profile
          ? `Ameaças e arquétipos priorizados pelo perfil ${profile.dataVersion}; uso real/roster-lock completo seguem dependentes de data pack dedicado.`
          : 'Bootstrap de Doubles até a entrada dos dados de temporada/regulação.',
        'A análise de Doubles considera leads, Protect pressure, speed control, weather/terrain e redirection via ChampionsRegulationEngine.',
      ],
    };
  }

  private getChampionsSinglesThreats(): Threat[] {
    return [
      ...this.getGenericSinglesThreats(),
      {
        name: 'Flutter Mane',
        importance: 92,
        types: ['Ghost', 'Fairy'],
        category: 'Special',
        baseSpeed: 135,
        tags: ['Special Sweeper', 'Speed Control', 'Regulation Sensitive'],
      },
      {
        name: 'Chien-Pao',
        importance: 90,
        types: ['Dark', 'Ice'],
        category: 'Physical',
        baseSpeed: 135,
        tags: ['Physical Breaker', 'Priority', 'Regulation Sensitive'],
      },
      {
        name: 'Urshifu-Rapid-Strike',
        importance: 88,
        types: ['Fighting', 'Water'],
        category: 'Physical',
        baseSpeed: 97,
        tags: ['Physical Breaker', 'Contact Pressure', 'Regulation Sensitive'],
      },
    ];
  }

  private getChampionsDoublesThreats(): Threat[] {
    return [
      {
        name: 'Incineroar',
        importance: 96,
        types: ['Fire', 'Dark'],
        category: 'Physical',
        baseSpeed: 60,
        tags: ['Pivot', 'Intimidate', 'Fake Out', 'Doubles Utility'],
      },
      {
        name: 'Rillaboom',
        importance: 93,
        types: ['Grass'],
        category: 'Physical',
        baseSpeed: 85,
        tags: ['Terrain', 'Priority', 'Fake Out', 'Doubles Utility'],
      },
      {
        name: 'Flutter Mane',
        importance: 92,
        types: ['Ghost', 'Fairy'],
        category: 'Special',
        baseSpeed: 135,
        tags: ['Special Sweeper', 'Speed Control', 'Spread Pressure'],
      },
      {
        name: 'Amoonguss',
        importance: 90,
        types: ['Grass', 'Poison'],
        category: 'Special',
        baseSpeed: 30,
        tags: ['Redirection', 'Status', 'Trick Room'],
      },
      {
        name: 'Tornadus',
        importance: 89,
        types: ['Flying'],
        category: 'Special',
        baseSpeed: 111,
        tags: ['Tailwind', 'Speed Control', 'Support'],
      },
      {
        name: 'Urshifu-Rapid-Strike',
        importance: 88,
        types: ['Fighting', 'Water'],
        category: 'Physical',
        baseSpeed: 97,
        tags: ['Physical Breaker', 'Protect Pressure', 'Doubles Pressure'],
      },
      {
        name: 'Indeedee-F',
        importance: 84,
        types: ['Psychic', 'Normal'],
        category: 'Special',
        baseSpeed: 85,
        tags: ['Terrain', 'Redirection', 'Trick Room Support'],
      },
    ];
  }

  private getGenericSinglesThreats(): Threat[] {
    return [
      {
        name: 'Kingambit',
        importance: 98,
        types: ['Dark', 'Steel'],
        category: 'Physical',
        baseSpeed: 50,
        tags: ['Late Game', 'Priority', 'Swords Dance'],
      },
      {
        name: 'Great Tusk',
        importance: 96,
        types: ['Ground', 'Fighting'],
        category: 'Physical',
        baseSpeed: 87,
        tags: ['Hazard Removal', 'Hazard Setter', 'Physical Pressure'],
      },
      {
        name: 'Dragapult',
        importance: 94,
        types: ['Dragon', 'Ghost'],
        category: 'Mixed',
        baseSpeed: 142,
        tags: ['Speed Control', 'Pivot', 'Special Pressure'],
      },
      {
        name: 'Gholdengo',
        importance: 92,
        types: ['Steel', 'Ghost'],
        category: 'Special',
        baseSpeed: 84,
        tags: ['Special Breaker', 'Hazard Control Denial'],
      },
      {
        name: 'Dragonite',
        importance: 90,
        types: ['Dragon', 'Flying'],
        category: 'Physical',
        baseSpeed: 80,
        tags: ['Setup Sweeper', 'Priority', 'Late Game'],
      },
      {
        name: 'Volcarona',
        importance: 90,
        types: ['Bug', 'Fire'],
        category: 'Special',
        baseSpeed: 100,
        tags: ['Setup Sweeper', 'Special Pressure'],
      },
      {
        name: 'Iron Valiant',
        importance: 89,
        types: ['Fairy', 'Fighting'],
        category: 'Mixed',
        baseSpeed: 116,
        tags: ['Speed Control', 'Mixed Breaker', 'Setup'],
      },
      {
        name: 'Walking Wake',
        importance: 86,
        types: ['Water', 'Dragon'],
        category: 'Special',
        baseSpeed: 109,
        tags: ['Special Breaker', 'Weather Abuser'],
      },
      {
        name: 'Kyurem',
        importance: 86,
        types: ['Dragon', 'Ice'],
        category: 'Mixed',
        baseSpeed: 95,
        tags: ['Wallbreaker', 'Mixed Pressure'],
      },
      {
        name: 'Raging Bolt',
        importance: 85,
        types: ['Electric', 'Dragon'],
        category: 'Special',
        baseSpeed: 75,
        tags: ['Priority', 'Special Pressure', 'Bulky Attacker'],
      },
      {
        name: 'Ogerpon-Wellspring',
        importance: 84,
        types: ['Grass', 'Water'],
        category: 'Physical',
        baseSpeed: 110,
        tags: ['Physical Breaker', 'Speed Control'],
      },
      {
        name: 'Roaring Moon',
        importance: 83,
        types: ['Dragon', 'Dark'],
        category: 'Physical',
        baseSpeed: 119,
        tags: ['Setup Sweeper', 'Physical Pressure'],
      },
    ];
  }
}
