import { ChampionsRegulationProfile } from './ChampionsRegulationProfile';
import { getChampionsMetaSourcePack } from './ChampionsMetaSourcePack';

const officialChampionsGameplayUrl = 'https://champions.pokemon.com/en-us/gameplay/';
const officialChampionsNewsUrl = 'https://champions.pokemon.com/en-us/news/';
const victoryRoadRegulationsUrl = 'https://victoryroad.pro/champions-regulations/';

const commonNotes = [
  'Pokémon Champions has Ranked, Casual, and Private Battles in both Single Battle and Double Battle formats.',
  'Ranked Battle regulations change across seasons; Pokémon eligibility and parameters can change with each regulation set.',
  'Regulation Set M-B is treated as the current live regulation profile until the next official ruleset replaces it.',
  'Sprint 18.5 adds a transparent meta source pack: official rules first, Victory Road regulation references second, and curated source weighting only where official usage is not available.',
];

const commonWarnings = [
  'Revalidate this profile whenever Pokémon Champions publishes a new Regulation Set or season update.',
  'This profile is source-aware, but still not a fully roster-locked output until eligible Pokémon and allowed Mega lists are imported as structured data packs.',
];

const metaPackFields = (profileId: string) => {
  const pack = getChampionsMetaSourcePack(profileId);

  if (!pack) return {};

  return {
    metaSourcePackId: pack.id,
    metaSourcePackLabel: pack.label,
    metaSourceStatus: pack.dataStatus,
    metaSourceConfidence: pack.confidence,
    sourceBreakdown: pack.sources.map(source => ({
      id: source.id,
      label: source.label,
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      reliability: source.reliability,
      status: source.status,
      scope: source.scope,
    })),
    metaArchetypes: pack.archetypes.map(archetype => ({
      id: archetype.id,
      label: archetype.label,
      battleStyle: archetype.battleStyle,
      reliability: archetype.reliability,
      priority: archetype.priority,
      corePokemon: archetype.corePokemon,
      supportPokemon: archetype.supportPokemon,
      tags: archetype.tags,
    })),
  };
};

export class ChampionsRegulationProfileRegistry {
  public normalizeFormat(format: string): string {
    const normalized = (format || 'champions_reg_m_b_singles')
      .toLowerCase()
      .trim()
      .replace(/[’']/g, '')
      .replace(/\+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .replace(/__+/g, '_');

    const aliases: Record<string, string> = {
      champion: 'champions_reg_m_b_singles',
      champions: 'champions_reg_m_b_singles',
      pokemon_champions: 'champions_reg_m_b_singles',
      pokemon_champions_singles: 'champions_reg_m_b_singles',
      champions_singles: 'champions_reg_m_b_singles',
      champions_single: 'champions_reg_m_b_singles',
      champions_1v1: 'champions_reg_m_b_singles',
      champions_ranked: 'champions_reg_m_b_singles',
      champions_ranked_singles: 'champions_reg_m_b_singles',
      pokemon_champions_ranked: 'champions_reg_m_b_singles',
      pokemon_champions_ranked_singles: 'champions_reg_m_b_singles',
      champions_m_b_singles: 'champions_reg_m_b_singles',
      champions_reg_m_b_singles: 'champions_reg_m_b_singles',
      champions_regulation_m_b_singles: 'champions_reg_m_b_singles',
      champions_mb_singles: 'champions_reg_m_b_singles',

      pokemon_champions_doubles: 'champions_reg_m_b_doubles',
      champions_doubles: 'champions_reg_m_b_doubles',
      champions_double: 'champions_reg_m_b_doubles',
      champions_ranked_doubles: 'champions_reg_m_b_doubles',
      pokemon_champions_ranked_doubles: 'champions_reg_m_b_doubles',
      champions_m_b_doubles: 'champions_reg_m_b_doubles',
      champions_reg_m_b_doubles: 'champions_reg_m_b_doubles',
      champions_regulation_m_b_doubles: 'champions_reg_m_b_doubles',
      champions_mb_doubles: 'champions_reg_m_b_doubles',
    };

    return aliases[normalized] ?? normalized;
  }

  public getProfile(format: string): ChampionsRegulationProfile | undefined {
    return CHAMPIONS_REGULATION_PROFILES[this.normalizeFormat(format)];
  }

  public isChampionsFormat(format: string): boolean {
    return this.getProfile(format) !== undefined;
  }
}

const profile = (value: ChampionsRegulationProfile): ChampionsRegulationProfile => value;

export const CHAMPIONS_REGULATION_PROFILES: Record<string, ChampionsRegulationProfile> = {
  champions_reg_m_b_singles: profile({
    id: 'champions_reg_m_b_singles',
    regulationSet: 'M-B',
    label: 'Pokémon Champions Regulation Set M-B — Singles',
    shortLabel: 'M-B Singles',
    battleStyle: 'singles',
    mode: 'ranked',
    seasonLabel: 'Ranked Battles Season M-B',
    startDate: '2026-06-17',
    endDate: '2026-09-02',
    dataVersion: 'champions-m-b-singles-v1',
    dataStatus: 'community',
    rosterStatus: 'pending_full_import',
    sourceName: 'Pokémon Champions official gameplay/news — Regulation Set M-B',
    sourceUrl: officialChampionsNewsUrl,
    secondarySourceName: 'Victory Road Pokémon Champions Regulations tracker',
    secondarySourceUrl: victoryRoadRegulationsUrl,
    ...metaPackFields('champions_reg_m_b_singles'),
    megaEvolutionAllowed: true,
    teamPreviewSize: 6,
    selectedForBattle: 3,
    keyThreats: getChampionsMetaSourcePack('champions_reg_m_b_singles')?.priorityThreats ?? [
      { name: 'Charizard-Mega', types: ['Fire', 'Flying'], category: 'Mixed', baseSpeed: 100, importance: 93, tags: ['Mega', 'Wallbreaker', 'Regulation Threat'] },
      { name: 'Kingambit', types: ['Dark', 'Steel'], category: 'Physical', baseSpeed: 50, importance: 91, tags: ['Priority', 'Endgame', 'Setup Check'] },
      { name: 'Sneasler', types: ['Fighting', 'Poison'], category: 'Physical', baseSpeed: 120, importance: 89, tags: ['Fast Physical', 'Ladder Tempo'] },
    ],
    rolePriorities: [
      'Fast revenge killer or priority answer',
      'Setup-sweeper counterplay',
      'Steel/Fairy/Ghost/Dark defensive coverage',
      'One clear Mega plan when Mega Evolution is enabled',
      'Enough immediate pressure to avoid passive ladder turns',
    ],
    notes: commonNotes,
    warnings: commonWarnings,
    uiTags: ['Pokémon Champions', 'Regulation M-B', 'Singles', 'Ranked', 'Mega Evolution'],
    weights: {
      speedControl: 1.35,
      roleCompression: 1.1,
      threatCoverage: 1.35,
      fieldControl: 0.75,
      megaReadiness: 1.1,
      consistency: 1.25,
    },
  }),

  champions_reg_m_b_doubles: profile({
    id: 'champions_reg_m_b_doubles',
    regulationSet: 'M-B',
    label: 'Pokémon Champions Regulation Set M-B — Doubles',
    shortLabel: 'M-B Doubles',
    battleStyle: 'doubles',
    mode: 'ranked',
    seasonLabel: 'Ranked Battles Season M-B',
    startDate: '2026-06-17',
    endDate: '2026-09-02',
    dataVersion: 'champions-m-b-doubles-v1',
    dataStatus: 'community',
    rosterStatus: 'pending_full_import',
    sourceName: 'Pokémon Champions official gameplay/news — Regulation Set M-B',
    sourceUrl: officialChampionsGameplayUrl,
    secondarySourceName: 'Victory Road Pokémon Champions Regulations tracker',
    secondarySourceUrl: victoryRoadRegulationsUrl,
    ...metaPackFields('champions_reg_m_b_doubles'),
    megaEvolutionAllowed: true,
    teamPreviewSize: 6,
    selectedForBattle: 4,
    keyThreats: getChampionsMetaSourcePack('champions_reg_m_b_doubles')?.priorityThreats ?? [
      { name: 'Incineroar', types: ['Fire', 'Dark'], category: 'Utility', baseSpeed: 60, importance: 96, tags: ['Fake Out', 'Intimidate', 'Pivot', 'Doubles Utility'] },
      { name: 'Charizard-Mega', types: ['Fire', 'Flying'], category: 'Mixed', baseSpeed: 100, importance: 94, tags: ['Mega', 'Sun', 'Spread Pressure'] },
      { name: 'Sneasler', types: ['Fighting', 'Poison'], category: 'Physical', baseSpeed: 120, importance: 92, tags: ['Fast Physical', 'Status Pressure'] },
    ],
    rolePriorities: [
      'Speed control through Tailwind, priority, fast pressure, or Trick Room structure',
      'Fake Out / pivot pressure or equivalent tempo denial',
      'Redirection, terrain, weather, or board-control utility',
      'Spread pressure and Protect-aware damage lines',
      'One clear Mega plan without overloading the team around it',
    ],
    notes: commonNotes,
    warnings: commonWarnings,
    uiTags: ['Pokémon Champions', 'Regulation M-B', 'Doubles', 'Ranked', 'Mega Evolution'],
    weights: {
      speedControl: 1.35,
      roleCompression: 1.35,
      threatCoverage: 1.15,
      fieldControl: 1.45,
      megaReadiness: 1.05,
      consistency: 1.3,
    },
  }),
};
