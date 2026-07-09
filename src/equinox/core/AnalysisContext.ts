import { createEmptyScore, ScoreBreakdown } from './Score';
import { ExplanationEntry } from './Explanation';
import { ThreatAnalysis } from '../threats/Threat';
import { MetaAnalysis } from '../meta/MetaFormat';
import { CoachAnalysis } from '../coach/CoachAnalysis';
import { DamageReport } from '../damage/DamageReport';
import { AIBuilderAnalysis } from '../builder/AIBuilderAnalysis';
import { FormatIntelligenceAnalysis } from '../formats/FormatIntelligence';
import { RadicalRedGauntletAnalysis } from '../radicalred/RadicalRedBossProfile';
import { ChampionsRegulationAnalysis } from '../champions/ChampionsRegulationProfile';
import { EquinoxDataSourceReport } from '../data/DataSourceReport';

export interface PokemonVariant {
  formatId: string;
  baseStats?: {
    hp?: number;
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
  };
  types?: string[];
  abilities?: Record<string, string>;
}

export interface CompetitiveMetadata {
  roles?: string[];
  offensiveTags?: string[];
  defensiveTags?: string[];
  utilityTags?: string[];
  teamStyles?: string[];
}

export interface PokemonData {
  name: string;
  dexNumber?: number;
  isLegendary?: boolean;
  variants?: PokemonVariant[];
  types?: string[];
  abilities?: Record<string, string>;
  competitive?: CompetitiveMetadata;
  ability?: string;
  item?: string;
  moves?: string[];
  nature?: string;
  role?: string;
}

export interface DefensiveTypeSummary {
  type: string;
  maxMultiplier: number;
  minMultiplier: number;
  hasWeakness: boolean;
  hasFatalWeakness: boolean;
  hasReliableSwitchIn: boolean;
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

export interface RoleAnalysis {
  detectedRoles: Record<string, number>;
  missingRoles: string[];
  duplicatedRoles: string[];
  roleCoverageRatio: number;
}

export interface SynergyAnalysis {
  weatherScore: number;
  terrainScore: number;
  trickRoomScore: number;
  momentumScore: number;
  itemClauseScore: number;
  totalSynergyScore: number;
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

export interface TeamAnalysis {
  defensiveMatrix: DefensiveTypeSummary[];
  fatalUncovered: number;
  normalUncovered: number;
  totalWeaknesses: number;
  offensiveCoverage?: OffensiveCoverageAnalysis;
  roles?: RoleAnalysis;
  speed?: SpeedAnalysis;
  synergy?: SynergyAnalysis;
  threats?: ThreatAnalysis;
  meta?: MetaAnalysis;
  coach?: CoachAnalysis;
  damage?: DamageReport;
  aiBuilder?: AIBuilderAnalysis;
  formatIntelligence?: FormatIntelligenceAnalysis;
  radicalRedGauntlet?: RadicalRedGauntletAnalysis;
  championsRegulation?: ChampionsRegulationAnalysis;
  dataSources?: EquinoxDataSourceReport;
}

interface AnalysisContextParams {
  format: string;
  selectedPokemon: PokemonData[];
  candidatePool?: PokemonData[];
  teamIdentity?: string;
}

export class AnalysisContext {
  public readonly format: string;
  public readonly selectedPokemon: PokemonData[];
  public readonly candidatePool: PokemonData[];
  public readonly teamIdentity: string;

  public analysis: TeamAnalysis;
  public score: ScoreBreakdown;
  public explanations: ExplanationEntry[];

  constructor(params: AnalysisContextParams) {
    this.format = params.format;
    this.selectedPokemon = params.selectedPokemon;
    this.candidatePool = params.candidatePool ?? [];
    this.teamIdentity = params.teamIdentity ?? 'balanced';

    this.analysis = {
      defensiveMatrix: [],
      fatalUncovered: 0,
      normalUncovered: 0,
      totalWeaknesses: 0,
    };

    this.score = createEmptyScore();
    this.explanations = [];
  }

  public addExplanation(entry: ExplanationEntry): void {
    this.explanations.push(entry);
  }
}