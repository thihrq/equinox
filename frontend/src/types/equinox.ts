
export type FormatIntelligenceMode =
  | 'generic_balance'
  | 'meta_ladder'
  | 'boss_gauntlet'
  | 'live_regulation';

export type FormatDataStatus = 'verified' | 'community' | 'outdated' | 'unknown';
export type FormatBattleStyle = 'generic' | 'singles' | 'doubles' | 'gauntlet';
export type FormatGameFamily = 'core' | 'smogon' | 'radical_red' | 'pokemon_champions';

export interface FormatIntelligenceWeights {
  balance: number;
  meta: number;
  boss: number;
  regulation: number;
  defense: number;
  speed: number;
  roles: number;
  threats: number;
  consistency: number;
  worstMatchup: number;
}

export interface FormatIntelligenceAnalysis {
  id: string;
  label: string;
  gameFamily: FormatGameFamily;
  mode: FormatIntelligenceMode;
  battleStyle: FormatBattleStyle;
  engineStrategy: string;
  description: string;
  sourceName: string;
  sourceUrl?: string;
  sourceUpdatedAt?: string;
  dataVersion: string;
  dataStatus: FormatDataStatus;
  fallbackFormat: 'vanilla' | 'radical_red' | 'national_dex';
  usesMeta: boolean;
  usesBossData: boolean;
  usesRegulationData: boolean;
  warning?: string;
  uiTags: string[];
  weights: FormatIntelligenceWeights;
  normalizedFrom: string;
  isScenarioAware: boolean;
  freshnessLabel: string;
}

export type TeamIdentity =
  | 'balanced'
  | 'bulky_offense'
  | 'hyper_offense'
  | 'stall'
  | 'speed'
  | 'fun';

export interface PokemonKit {
  role: string;
  nature: string;
}

export interface BattleInsight {
  practicalRole: string;
  offers: string[];
  pressures: string[];
  risks: string[];
  usageTip: string;
}

export interface SuggestedPokemon {
  name: string;
  kit: PokemonKit;
  battleInsight?: BattleInsight;
}

export interface ScoreBreakdown {
  coverage: number;
  defense: number;
  offense: number;
  roles: number;
  speed: number;
  meta: number;
  threats: number;
  cores: number;
  total: number;
}

export interface ExplanationEntry {
  engine: string;
  reason: string;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
  type?: string;
  pokemon?: string;
}

export interface RoleAnalysis {
  detectedRoles: Record<string, number>;
  missingRoles: string[];
  duplicatedRoles: string[];
  roleCoverageRatio: number;
}

export interface SpeedMemberAnalysis {
  name: string;
  baseSpeed: number;
  tier: 'Very Slow' | 'Slow' | 'Medium' | 'Fast' | 'Very Fast';
}

export interface SpeedAnalysis {
  members: SpeedMemberAnalysis[];
  averageBaseSpeed: number;
  fastestPokemon?: SpeedMemberAnalysis;
  slowestPokemon?: SpeedMemberAnalysis;
  fastCount: number;
  veryFastCount: number;
  slowCount: number;
  hasSpeedControl: boolean;
  speedProfile: 'Very Slow' | 'Slow' | 'Balanced' | 'Fast' | 'Very Fast';
}

export interface OffensiveTypeSummary {
  defendingType: string;
  bestMultiplier: number;
  coveringAttackTypes: string[];
  isCovered: boolean;
}

export interface OffensiveCoverageAnalysis {
  matrix: OffensiveTypeSummary[];
  coveredTypes: string[];
  uncoveredTypes: string[];
  coverageRatio: number;
  uniqueAttackTypes: string[];
}

export interface Threat {
  name: string;
  importance: number;
  types: string[];
  category: 'Physical' | 'Special' | 'Mixed';
  baseSpeed: number;
  tags: string[];
}

export interface ThreatMatchup {
  threat: Threat;
  score: number;
  level: 'Safe' | 'Good' | 'Neutral' | 'Dangerous' | 'Critical';
  answers: string[];
  problems: string[];
}

export interface ThreatAnalysis {
  averageScore: number;
  safeThreats: ThreatMatchup[];
  goodThreats: ThreatMatchup[];
  neutralThreats: ThreatMatchup[];
  dangerousThreats: ThreatMatchup[];
  criticalThreats: ThreatMatchup[];
  matchups: ThreatMatchup[];
}


export type MatchupLevel = 'Dominant' | 'Favorable' | 'Playable' | 'Risky' | 'Dangerous';

export interface PokemonMatchupAnswer {
  pokemon: string;
  score: number;
  confidence: number;
  level: MatchupLevel;
  reasons: string[];
  warnings: string[];
  defensiveScore: number;
  offensivePressure: number;
  speedAdvantage: number;
  roleCompatibility: number;
  riskPenalty: number;
}

export interface DamageMatchupReport {
  threat: Threat;
  bestAnswer: PokemonMatchupAnswer;
  alternativeAnswers: PokemonMatchupAnswer[];
  matchupScore: number;
  confidence: number;
  level: MatchupLevel;
  reasons: string[];
  warnings: string[];
}

export interface DamageReport {
  averageMatchupScore: number;
  averageConfidence: number;
  dominantMatchups: DamageMatchupReport[];
  favorableMatchups: DamageMatchupReport[];
  playableMatchups: DamageMatchupReport[];
  riskyMatchups: DamageMatchupReport[];
  dangerousMatchups: DamageMatchupReport[];
  matchups: DamageMatchupReport[];
}

export interface MetaWeights {
  coverage: number;
  defense: number;
  roles: number;
  speed: number;
  threats: number;
}

export interface MetaAnalysis {
  id: 'vanilla' | 'radical_red' | 'national_dex' | 'champions_singles' | 'champions_ranked_singles' | 'champions_doubles' | 'champions_ranked_doubles' | 'champions_reg_m_b_singles' | 'champions_reg_m_b_doubles';
  name: string;
  description: string;
  threatProfileName: string;
  threatCount: number;
  weights: MetaWeights;
  notes: string[];
}

export interface CoachAnalysis {
  overview: string;
  earlyGame: string[];
  midGame: string[];
  lateGame: string[];
  winConditions: string[];
  keyPokemon: string[];
  preservePokemon: string[];
  sacrificeCandidates: string[];
  leadSuggestions: string[];
  switchPatterns: string[];
}

export interface CandidateDiversityInsight {
  name: string;
  score: number;
  roles: string[];
  types: string[];
  reasons: string[];
}

export interface CandidateDiversitySummary {
  rawCandidates: number;
  validCandidates: number;
  scoredCandidates: number;
  diversifiedCandidates: number;
  topCandidates: CandidateDiversityInsight[];
}


export type RadicalRedBossStage = 'elite_four' | 'champion';
export type RadicalRedBossMode = 'normal' | 'hardcore';
export type RadicalRedBossLevel = 'Dominant' | 'Favorable' | 'Playable' | 'Risky' | 'Dangerous';
export type RadicalRedDataStatus = 'verified' | 'community' | 'outdated' | 'unknown';

export interface RadicalRedBossPokemon {
  name: string;
  types: string[];
  category: 'Physical' | 'Special' | 'Mixed';
  importance: number;
  baseSpeed: number;
  level?: number;
  item?: string;
  ability?: string;
  nature?: string;
  moves?: string[];
  role?: string;
  tags: string[];
}

export interface RadicalRedThreatAnswer {
  pokemon: string;
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  reasons: string[];
  warnings: string[];
}

export interface RadicalRedThreatReport {
  threat: RadicalRedBossPokemon;
  bestAnswer: RadicalRedThreatAnswer;
  alternativeAnswers: RadicalRedThreatAnswer[];
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  reasons: string[];
  warnings: string[];
}

export interface RadicalRedBossVariantReport {
  id: string;
  label: string;
  trigger?: string;
  battleEffect?: string;
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  criticalThreats: RadicalRedThreatReport[];
  bestCoveredThreats: RadicalRedThreatReport[];
  worstThreat?: RadicalRedThreatReport;
  threatReports: RadicalRedThreatReport[];
}

export interface RadicalRedBossReport {
  id: string;
  name: string;
  stage: RadicalRedBossStage;
  order: number;
  score: number;
  confidence: number;
  level: RadicalRedBossLevel;
  notes: string[];
  requiredAnswers: string[];
  worstVariant: RadicalRedBossVariantReport;
  variants: RadicalRedBossVariantReport[];
}

export interface RadicalRedGauntletAnalysis {
  profileId: string;
  label: string;
  version: string;
  mode: RadicalRedBossMode;
  dataStatus: RadicalRedDataStatus;
  dataVersion: string;
  sourceName: string;
  sourceUpdatedAt?: string;
  dataHash: string;
  averageBossScore: number;
  worstBossScore: number;
  consistencyScore: number;
  confidence: number;
  level: RadicalRedBossLevel;
  worstBoss?: RadicalRedBossReport;
  bossReports: RadicalRedBossReport[];
  criticalThreats: RadicalRedThreatReport[];
  requiredActions: string[];
  warnings: string[];
}


export type ChampionsBattleStyle = 'singles' | 'doubles';
export type ChampionsMode = 'ranked' | 'casual' | 'private';
export type ChampionsRegulationStatus = 'verified' | 'community' | 'outdated' | 'unknown';
export type ChampionsMetaSourceStatus = 'verified' | 'community' | 'bootstrap' | 'pending' | 'outdated' | 'unknown';
export type ChampionsMetaSourceReliability = 'official' | 'tournament_derived' | 'community' | 'bootstrap';
export type ChampionsRegulationLevel = 'Excellent' | 'Strong' | 'Playable' | 'Fragile' | 'Unsafe';
export type ChampionsThreatCategory = 'Physical' | 'Special' | 'Mixed' | 'Utility';

export interface ChampionsRegulationThreat {
  name: string;
  types: string[];
  category: ChampionsThreatCategory;
  baseSpeed: number;
  importance: number;
  tags: string[];
}

export interface ChampionsMetaSourceSummary {
  id: string;
  label: string;
  sourceName: string;
  sourceUrl?: string;
  reliability: ChampionsMetaSourceReliability;
  status: ChampionsMetaSourceStatus;
  scope: string;
}

export interface ChampionsMetaArchetypeSummary {
  id: string;
  label: string;
  battleStyle: ChampionsBattleStyle;
  reliability: ChampionsMetaSourceReliability;
  priority: number;
  corePokemon: string[];
  supportPokemon: string[];
  tags: string[];
}

export interface ChampionsRoleCoverage {
  speedControl: number;
  roleCompression: number;
  threatCoverage: number;
  fieldControl: number;
  megaReadiness: number;
  consistency: number;
}

export interface ChampionsThreatAnswer {
  threat: ChampionsRegulationThreat;
  bestAnswer?: string;
  score: number;
  confidence: number;
  level: ChampionsRegulationLevel;
  reasons: string[];
  warnings: string[];
}

export interface ChampionsRegulationAnalysis {
  profileId: string;
  regulationSet: string;
  label: string;
  battleStyle: ChampionsBattleStyle;
  mode: ChampionsMode;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  dataVersion: string;
  dataStatus: ChampionsRegulationStatus;
  rosterStatus: 'official_summary' | 'community_curated' | 'pending_full_import';
  sourceName: string;
  sourceUrl: string;
  secondarySourceName?: string;
  secondarySourceUrl?: string;
  metaSourcePackId?: string;
  metaSourcePackLabel?: string;
  metaSourceStatus?: ChampionsMetaSourceStatus;
  metaSourceConfidence?: number;
  sourceBreakdown?: ChampionsMetaSourceSummary[];
  metaArchetypes?: ChampionsMetaArchetypeSummary[];
  megaEvolutionAllowed: boolean;
  teamPreviewSize: number;
  selectedForBattle: number;
  score: number;
  confidence: number;
  level: ChampionsRegulationLevel;
  roleCoverage: ChampionsRoleCoverage;
  threatAnswers: ChampionsThreatAnswer[];
  keyThreats: ChampionsRegulationThreat[];
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  notes: string[];
  warnings: string[];
  uiTags: string[];
}


export type AIBuilderProfileId =
  | 'recommended'
  | 'offensive'
  | 'defensive'
  | 'anti_meta'
  | 'creative'
  | 'tempo'
  | 'balanced'
  | 'gauntlet'
  | 'regulation';

export type AIBuilderRiskLevel = 'Low' | 'Medium' | 'High';

export interface AIBuilderProfile {
  id: AIBuilderProfileId;
  name: string;
  summary: string;
}

export interface AIBuilderScores {
  defense: number;
  offense: number;
  roles: number;
  speed: number;
  threats: number;
  matchups: number;
  coach: number;
  metaFit: number;
  gauntletFit?: number;
  regulationFit?: number;
  total: number;
}

export interface AIBuilderAnalysis {
  profile: AIBuilderProfile;
  confidence: number;
  decisionScore: number;
  riskLevel: AIBuilderRiskLevel;
  scores: AIBuilderScores;
  strengths: string[];
  concerns: string[];
  priorities: string[];
  playstyleTags: string[];
  recommendedLead?: string;
  primaryWinCondition?: string;
  battlePlanSummary: string;
}



export type EquinoxDataSourceCategory =
  | 'format'
  | 'vanilla_pool'
  | 'boss_gauntlet'
  | 'regulation'
  | 'roster'
  | 'meta';

export type EquinoxDataSourceStatus =
  | 'verified'
  | 'community'
  | 'bootstrap'
  | 'pending'
  | 'outdated'
  | 'unknown';

export type EquinoxDataSourceSeverity = 'ok' | 'notice' | 'warning' | 'critical';

export interface EquinoxDataSourceEntry {
  id: string;
  title: string;
  category: EquinoxDataSourceCategory;
  status: EquinoxDataSourceStatus;
  severity: EquinoxDataSourceSeverity;
  version?: string;
  scope: string;
  sourceName: string;
  sourceUrl?: string;
  sourceUpdatedAt?: string;
  dataHash?: string;
  notes: string[];
  warnings: string[];
  refreshPolicy: string;
}

export interface EquinoxDataSourceReport {
  overallStatus: EquinoxDataSourceStatus;
  confidence: number;
  entries: EquinoxDataSourceEntry[];
  criticalWarnings: string[];
  updateChecklist: string[];
  generatedAt: string;
}

export interface TeamOption {
  suggestedPokemons: SuggestedPokemon[];
  reasoning: string;
  stats: {
    fatalUncovered: number;
    normalUncovered: number;
    totalWeaknesses: number;
  };
  score?: ScoreBreakdown;
  explanations?: ExplanationEntry[];
  roles?: RoleAnalysis;
  speed?: SpeedAnalysis;
  offensiveCoverage?: OffensiveCoverageAnalysis;
  threatAnalysis?: ThreatAnalysis;
  metaAnalysis?: MetaAnalysis;
  coach?: CoachAnalysis;
  damageReport?: DamageReport;
  aiBuilder?: AIBuilderAnalysis;
  formatIntelligence?: FormatIntelligenceAnalysis;
  radicalRedGauntlet?: RadicalRedGauntletAnalysis;
  championsRegulation?: ChampionsRegulationAnalysis;
  dataSourceReport?: EquinoxDataSourceReport;
}

export interface SuggestionResponse {
  topTeams: TeamOption[];
  candidateDiversity?: CandidateDiversitySummary;
}
