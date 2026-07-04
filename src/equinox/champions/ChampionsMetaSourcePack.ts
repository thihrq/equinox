import { ChampionsBattleStyle, ChampionsRegulationThreat } from './ChampionsRegulationProfile';

export type ChampionsMetaSourceReliability =
  | 'official'
  | 'tournament_derived'
  | 'community'
  | 'bootstrap';

export type ChampionsMetaSourceStatus =
  | 'verified'
  | 'community'
  | 'bootstrap'
  | 'pending'
  | 'outdated'
  | 'unknown';

export type ChampionsMetaSourceKind =
  | 'official_regulation'
  | 'eligible_roster_reference'
  | 'tournament_replicas'
  | 'strategy_article'
  | 'curated_bootstrap';

export interface ChampionsMetaSourceEntry {
  id: string;
  kind: ChampionsMetaSourceKind;
  label: string;
  sourceName: string;
  sourceUrl: string;
  sourceUpdatedAt?: string;
  reliability: ChampionsMetaSourceReliability;
  status: ChampionsMetaSourceStatus;
  scope: string;
  notes: string[];
  warnings: string[];
}

export interface ChampionsMetaArchetype {
  id: string;
  label: string;
  battleStyle: ChampionsBattleStyle;
  reliability: ChampionsMetaSourceReliability;
  priority: number;
  corePokemon: string[];
  supportPokemon: string[];
  tags: string[];
  notes: string[];
}

export interface ChampionsMetaSourcePack {
  id: string;
  regulationSet: string;
  label: string;
  battleStyle: ChampionsBattleStyle;
  dataVersion: string;
  dataStatus: ChampionsMetaSourceStatus;
  confidence: number;
  sourceUpdatedAt: string;
  sourceHash: string;
  sourcePolicy: string;
  sources: ChampionsMetaSourceEntry[];
  archetypes: ChampionsMetaArchetype[];
  priorityThreats: ChampionsRegulationThreat[];
  notes: string[];
  warnings: string[];
}

const officialGameplayUrl = 'https://champions.pokemon.com/en-us/gameplay/';
const officialNewsUrl = 'https://champions.pokemon.com/en-us/news/';
const victoryRoadRegulationsUrl = 'https://victoryroad.pro/champions-regulations/';
const victoryRoadReplicaUrl = 'https://victoryroad.pro/champions-replica/';

const officialRegulationSources = (battleStyle: ChampionsBattleStyle): ChampionsMetaSourceEntry[] => [
  {
    id: `official-gameplay-${battleStyle}`,
    kind: 'official_regulation',
    label: 'Pokémon Champions official gameplay rules',
    sourceName: 'Pokémon Champions official gameplay page',
    sourceUrl: officialGameplayUrl,
    sourceUpdatedAt: '2026-06-17',
    reliability: 'official',
    status: 'verified',
    scope: 'Battle modes, Single Battle, Double Battle, Ranked Battles, Mega Evolution, season/regulation model.',
    notes: [
      'Official source for Champions battle modes, battle styles, Ranked Battles, Mega Evolution support, and seasonal regulations.',
      'Used as the primary rule context before any community or tournament-derived weighting is applied.',
    ],
    warnings: [],
  },
  {
    id: `official-news-m-b-${battleStyle}`,
    kind: 'official_regulation',
    label: 'Regulation Set M-B official news',
    sourceName: 'Pokémon Champions official news',
    sourceUrl: officialNewsUrl,
    sourceUpdatedAt: '2026-06-17',
    reliability: 'official',
    status: 'verified',
    scope: 'Regulation Set M-B ranked season and Battle Pass announcement.',
    notes: [
      'Used to anchor the active Regulation Set M-B profile in the Equinox format registry.',
      'Does not by itself provide enough public usage data to treat ladder threats as fully verified.',
    ],
    warnings: [],
  },
  {
    id: `victory-road-regulations-m-b-${battleStyle}`,
    kind: 'eligible_roster_reference',
    label: 'Victory Road Regulation M-B tracker',
    sourceName: 'Victory Road Pokémon Champions Regulations',
    sourceUrl: victoryRoadRegulationsUrl,
    sourceUpdatedAt: '2026-06-17',
    reliability: 'community',
    status: 'community',
    scope: 'Regulation dates, VGC usage window, team rules, allowed-list references, and Mega Evolution references.',
    notes: [
      'Used as a competitive reference for Regulation Set M-B dates and tournament-facing rule details.',
      'Allowed roster and allowed Mega lists are linked from this reference, but are intentionally not yet imported as locked structured data.',
    ],
    warnings: [
      'Treat roster enforcement as pending until the allowed-list references are imported as a versioned Equinox data pack.',
    ],
  },
];

export const CHAMPIONS_M_B_SINGLES_META_SOURCE_PACK: ChampionsMetaSourcePack = {
  id: 'champions-m-b-singles-meta-source-v1',
  regulationSet: 'M-B',
  label: 'Pokémon Champions M-B Singles Meta Source Pack',
  battleStyle: 'singles',
  dataVersion: 'champions-m-b-singles-meta-source-v1',
  dataStatus: 'community',
  confidence: 76,
  sourceUpdatedAt: '2026-06-17',
  sourceHash: 'champions-m-b-singles:official-news+gameplay+vr-regulations+curated-bootstrap:v1',
  sourcePolicy: 'Official rules first; curated singles pressure model second; no roster lock until an eligible roster data pack is imported.',
  sources: [
    ...officialRegulationSources('singles'),
    {
      id: 'equinox-singles-pressure-bootstrap-m-b',
      kind: 'curated_bootstrap',
      label: 'Equinox Champions Singles pressure bootstrap',
      sourceName: 'Equinox curated Champions Singles bootstrap',
      sourceUrl: officialGameplayUrl,
      sourceUpdatedAt: '2026-06-17',
      reliability: 'bootstrap',
      status: 'bootstrap',
      scope: 'Singles ladder heuristics for speed, setup prevention, priority, Mega plan, and direct matchup coverage.',
      notes: [
        'Used because public, source-backed Singles usage is still thinner than VGC-style Doubles data.',
        'The bootstrap is deliberately transparent and receives lower confidence than official or tournament-derived sources.',
      ],
      warnings: [
        'Replace this source with official usage, high-ladder usage, or verified sample teams when available.',
      ],
    },
  ],
  archetypes: [
    {
      id: 'singles-mega-balance',
      label: 'Mega balance with priority safety',
      battleStyle: 'singles',
      reliability: 'bootstrap',
      priority: 84,
      corePokemon: ['Charizard', 'Tyranitar', 'Gyarados', 'Kingambit'],
      supportPokemon: ['Rotom-Wash', 'Milotic', 'Aegislash', 'Garchomp'],
      tags: ['Mega Plan', 'Priority', 'Balanced Singles', 'Endgame Control'],
      notes: ['Prioritizes one Mega anchor, one anti-setup line, and at least one reliable priority or revenge-kill option.'],
    },
    {
      id: 'singles-fast-offense',
      label: 'Fast offense with anti-setup pressure',
      battleStyle: 'singles',
      reliability: 'bootstrap',
      priority: 80,
      corePokemon: ['Sneasler', 'Aerodactyl', 'Gengar', 'Greninja'],
      supportPokemon: ['Kingambit', 'Dragonite', 'Garchomp', 'Aegislash'],
      tags: ['Speed Control', 'Revenge Kill', 'Anti Setup', 'Ladder Tempo'],
      notes: ['Uses high speed and priority backup to avoid losing to a single setup sequence.'],
    },
  ],
  priorityThreats: [
    { name: 'Charizard-Mega', types: ['Fire', 'Flying'], category: 'Mixed', baseSpeed: 100, importance: 93, tags: ['Mega', 'Weather Pressure', 'Wallbreaker'] },
    { name: 'Kingambit', types: ['Dark', 'Steel'], category: 'Physical', baseSpeed: 50, importance: 91, tags: ['Priority', 'Endgame', 'Setup Check'] },
    { name: 'Sneasler', types: ['Fighting', 'Poison'], category: 'Physical', baseSpeed: 120, importance: 89, tags: ['Fast Physical', 'Status Pressure', 'Ladder Tempo'] },
    { name: 'Garchomp', types: ['Dragon', 'Ground'], category: 'Physical', baseSpeed: 102, importance: 88, tags: ['Ground Pressure', 'Speed Tier', 'Physical Breaker'] },
    { name: 'Rotom-Wash', types: ['Electric', 'Water'], category: 'Utility', baseSpeed: 86, importance: 84, tags: ['Pivot', 'Bulky Utility', 'Water/Electric Coverage'] },
    { name: 'Aegislash', types: ['Steel', 'Ghost'], category: 'Mixed', baseSpeed: 60, importance: 83, tags: ['Steel/Ghost', 'Priority', 'Role Compression'] },
  ],
  notes: [
    'Singles uses official Regulation M-B context plus a transparent Equinox pressure model until reliable Singles usage becomes available.',
    'This pack should not be presented as official usage data.',
  ],
  warnings: [
    'Singles threat weights are still partly bootstrap because public Pokémon Champions Singles usage is not fully imported.',
  ],
};

export const CHAMPIONS_M_B_DOUBLES_META_SOURCE_PACK: ChampionsMetaSourcePack = {
  id: 'champions-m-b-doubles-meta-source-v1',
  regulationSet: 'M-B',
  label: 'Pokémon Champions M-B Doubles Meta Source Pack',
  battleStyle: 'doubles',
  dataVersion: 'champions-m-b-doubles-meta-source-v1',
  dataStatus: 'community',
  confidence: 82,
  sourceUpdatedAt: '2026-06-17',
  sourceHash: 'champions-m-b-doubles:official-news+gameplay+vr-regulations+vr-replica-prior:v1',
  sourcePolicy: 'Official rules and M-B regulation first; Victory Road tournament/replica teams as community-derived meta prior; no roster lock until allowed-list import.',
  sources: [
    ...officialRegulationSources('doubles'),
    {
      id: 'victory-road-replica-teams-prior',
      kind: 'tournament_replicas',
      label: 'Victory Road Pokémon Champions replica teams',
      sourceName: 'Victory Road Pokémon Champions Replica Teams',
      sourceUrl: victoryRoadReplicaUrl,
      sourceUpdatedAt: '2026-05-29',
      reliability: 'tournament_derived',
      status: 'community',
      scope: 'Tournament-derived and accomplished-player teams used as a prior for Doubles archetypes and role compression.',
      notes: [
        'Used only as a meta prior, not as official usage statistics.',
        'The source includes teams from early Pokémon Champions competition and ladder-ready examples.',
      ],
      warnings: [
        'Replica teams are not a complete M-B usage report; weights must be refreshed when M-B tournament results mature.',
      ],
    },
  ],
  archetypes: [
    {
      id: 'doubles-fake-out-tailwind-tempo',
      label: 'Fake Out + Tailwind tempo',
      battleStyle: 'doubles',
      reliability: 'tournament_derived',
      priority: 94,
      corePokemon: ['Incineroar', 'Sneasler', 'Tornadus', 'Whimsicott', 'Talonflame'],
      supportPokemon: ['Garchomp', 'Kingambit', 'Milotic', 'Rotom-Wash'],
      tags: ['Fake Out', 'Tailwind', 'Tempo', 'Pivot'],
      notes: ['Prioritizes immediate board control and speed advantage over generic type balance.'],
    },
    {
      id: 'doubles-sun-mega-pressure',
      label: 'Sun Mega pressure',
      battleStyle: 'doubles',
      reliability: 'tournament_derived',
      priority: 90,
      corePokemon: ['Charizard', 'Torkoal', 'Venusaur'],
      supportPokemon: ['Incineroar', 'Farigiraf', 'Kingambit', 'Garchomp'],
      tags: ['Weather', 'Mega Plan', 'Spread Pressure', 'Speed Control'],
      notes: ['Rewards weather support, safe Mega positioning, and anti-priority support.'],
    },
    {
      id: 'doubles-trick-room-balance',
      label: 'Trick Room balance',
      battleStyle: 'doubles',
      reliability: 'tournament_derived',
      priority: 86,
      corePokemon: ['Farigiraf', 'Hatterene', 'Torkoal'],
      supportPokemon: ['Incineroar', 'Kingambit', 'Milotic', 'Aegislash'],
      tags: ['Trick Room', 'Board Control', 'Bulky Offense'],
      notes: ['Values slow pressure, Fake Out support, redirection denial, and anti-priority positioning.'],
    },
    {
      id: 'doubles-balance-pivot-core',
      label: 'Balance pivot core',
      battleStyle: 'doubles',
      reliability: 'tournament_derived',
      priority: 84,
      corePokemon: ['Incineroar', 'Milotic', 'Garchomp', 'Kingambit'],
      supportPokemon: ['Rotom-Wash', 'Aegislash', 'Sneasler', 'Sinistcha'],
      tags: ['Intimidate', 'Pivot', 'Anti Intimidate', 'Role Compression'],
      notes: ['Rewards role compression and flexible leads instead of six isolated one-on-one answers.'],
    },
  ],
  priorityThreats: [
    { name: 'Incineroar', types: ['Fire', 'Dark'], category: 'Utility', baseSpeed: 60, importance: 97, tags: ['Fake Out', 'Intimidate', 'Pivot', 'Doubles Utility'] },
    { name: 'Charizard-Mega', types: ['Fire', 'Flying'], category: 'Mixed', baseSpeed: 100, importance: 94, tags: ['Mega', 'Sun', 'Spread Pressure'] },
    { name: 'Sneasler', types: ['Fighting', 'Poison'], category: 'Physical', baseSpeed: 120, importance: 92, tags: ['Fast Physical', 'Fake Out Pressure', 'Status Pressure'] },
    { name: 'Kingambit', types: ['Dark', 'Steel'], category: 'Physical', baseSpeed: 50, importance: 90, tags: ['Priority', 'Endgame', 'Trick Room Compatible'] },
    { name: 'Garchomp', types: ['Dragon', 'Ground'], category: 'Physical', baseSpeed: 102, importance: 89, tags: ['Ground Pressure', 'Spread Pressure', 'Speed Tier'] },
    { name: 'Farigiraf', types: ['Normal', 'Psychic'], category: 'Utility', baseSpeed: 60, importance: 87, tags: ['Trick Room', 'Anti Priority', 'Support'] },
    { name: 'Milotic', types: ['Water'], category: 'Utility', baseSpeed: 81, importance: 85, tags: ['Anti Intimidate', 'Bulky Water', 'Utility'] },
    { name: 'Rotom-Wash', types: ['Electric', 'Water'], category: 'Utility', baseSpeed: 86, importance: 83, tags: ['Pivot', 'Water/Electric Coverage', 'Bulky Utility'] },
  ],
  notes: [
    'Doubles uses official Regulation M-B context plus tournament-derived prior information from Victory Road replica/team resources.',
    'This is a source pack for role/archetype weighting, not a complete usage-statistics import.',
  ],
  warnings: [
    'M-B tournament/ladder usage should replace these prior weights once a stable source exists.',
  ],
};

export const CHAMPIONS_META_SOURCE_PACKS: Record<string, ChampionsMetaSourcePack> = {
  champions_reg_m_b_singles: CHAMPIONS_M_B_SINGLES_META_SOURCE_PACK,
  champions_reg_m_b_doubles: CHAMPIONS_M_B_DOUBLES_META_SOURCE_PACK,
};

export function getChampionsMetaSourcePack(formatOrProfileId: string): ChampionsMetaSourcePack | undefined {
  const normalized = formatOrProfileId
    .toLowerCase()
    .trim()
    .replace(/[’']/g, '')
    .replace(/\+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/__+/g, '_');

  if (normalized.includes('doubles') || normalized.includes('double')) {
    return CHAMPIONS_M_B_DOUBLES_META_SOURCE_PACK;
  }

  if (normalized.includes('champions')) {
    return CHAMPIONS_M_B_SINGLES_META_SOURCE_PACK;
  }

  return CHAMPIONS_META_SOURCE_PACKS[normalized];
}
