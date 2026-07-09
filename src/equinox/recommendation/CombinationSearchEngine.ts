import { AnalysisContext, PokemonData } from '../core/AnalysisContext';
import { AnalysisPipeline } from '../core/AnalysisPipeline';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { RadicalRedGauntletScorer } from '../radicalred/RadicalRedGauntletScorer';
import { ChampionsRegulationScorer } from '../champions/ChampionsRegulationScorer';

export interface EvaluatedCombination {
  team: PokemonData[];
  context: AnalysisContext;
}

export interface CombinationCandidateProfile {
  score: number;
  roles: string[];
  types: string[];
}

interface FindBestTriosParams {
  baseTeam: PokemonData[];
  candidates: PokemonData[];
  format: string;
  teamIdentity?: string;
  candidateProfiles?: Record<string, CombinationCandidateProfile>;
}

interface CombinationSearchOptions {
  /**
   * Maximum number of trios that should go through the full analysis pipeline.
   * The optimizer still scans every valid trio, but only runs expensive engines
   * for the best heuristic search space.
   */
  maxPipelineEvaluations: number;

  /**
   * Percentage of the search budget reserved for the highest heuristic scores.
   * The remaining budget is used for deterministic exploration, preserving
   * diversity without returning to full brute force.
   */
  exploitationRatio: number;

  /**
   * Number of top candidates that should force at least a few trios into
   * the selected search space. Lower values are useful for scenario-heavy
   * formats where the heuristic is already highly specific.
   */
  anchorCandidateLimit: number;

  /**
   * Maximum trios added for each anchor candidate during diversity coverage.
   */
  perAnchorCombinations: number;
}

interface OptimizedTrioCandidate {
  trio: PokemonData[];
  signature: string;
  heuristicScore: number;
}

interface OptimizerStats {
  totalPossible: number;
  validGenerated: number;
  selectedForPipeline: number;
  skippedInvalid: number;
}

export class CombinationSearchEngine {
  private readonly radicalRedScorer = new RadicalRedGauntletScorer();
  private readonly championsScorer = new ChampionsRegulationScorer();
  private readonly options: CombinationSearchOptions;

  constructor(
    private readonly pipeline: AnalysisPipeline,
    private readonly maxToKeep: number = 300,
    options?: Partial<CombinationSearchOptions>,
  ) {
    this.options = {
      maxPipelineEvaluations: options?.maxPipelineEvaluations ?? 8500,
      exploitationRatio: options?.exploitationRatio ?? 0.78,
      anchorCandidateLimit: options?.anchorCandidateLimit ?? 24,
      perAnchorCombinations: options?.perAnchorCombinations ?? 18,
    };
  }

  public async findBestTrios(
    params: FindBestTriosParams,
  ): Promise<EvaluatedCombination[]> {
    const { baseTeam, candidates, format, teamIdentity = 'balanced' } = params;
    const best: EvaluatedCombination[] = [];

    const { trios, stats } = this.buildOptimizedSearchSpace(params);

    console.log(
      `[Equinox] CombinationOptimizer: possible=${stats.totalPossible}, valid=${stats.validGenerated}, evaluated=${stats.selectedForPipeline}, skippedInvalid=${stats.skippedInvalid}, exploitation=${this.options.exploitationRatio}, anchors=${this.options.anchorCandidateLimit}x${this.options.perAnchorCombinations}`,
    );

    for (const candidate of trios) {
      const fullTeam = [...baseTeam, ...candidate.trio];

      const context = new AnalysisContext({
        format,
        selectedPokemon: fullTeam,
        candidatePool: candidates,
        teamIdentity,
      });

      await this.pipeline.run(context);

      this.insertIfRelevant(best, {
        team: candidate.trio,
        context,
      });
    }

    return best.sort(this.compareCombinations);
  }

  private buildOptimizedSearchSpace(
    params: FindBestTriosParams,
  ): { trios: OptimizedTrioCandidate[]; stats: OptimizerStats } {
    const { baseTeam, candidates, format } = params;
    const len = candidates.length;
    const totalPossible = this.combinationCount(len, 3);
    const allValid: OptimizedTrioCandidate[] = [];
    let skippedInvalid = 0;

    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        for (let k = j + 1; k < len; k++) {
          const trio = [candidates[i], candidates[j], candidates[k]];
          const fullTeam = [...baseTeam, ...trio];

          if (!this.isValidTeam(fullTeam, baseTeam, format)) {
            skippedInvalid++;
            continue;
          }

          allValid.push({
            trio,
            signature: this.getSignature(trio),
            heuristicScore: this.calculateHeuristicScore(trio, params),
          });
        }
      }
    }

    allValid.sort((a, b) => b.heuristicScore - a.heuristicScore);

    const searchBudget = Math.min(
      this.options.maxPipelineEvaluations,
      allValid.length,
    );

    if (allValid.length <= searchBudget) {
      return {
        trios: allValid,
        stats: {
          totalPossible,
          validGenerated: allValid.length,
          selectedForPipeline: allValid.length,
          skippedInvalid,
        },
      };
    }

    const selected = new Map<string, OptimizedTrioCandidate>();
    const exploitationBudget = Math.max(
      1,
      Math.floor(searchBudget * this.options.exploitationRatio),
    );

    for (const trio of allValid.slice(0, exploitationBudget)) {
      selected.set(trio.signature, trio);
    }

    this.addAnchorCoverage({
      selected,
      allValid,
      candidates,
      searchBudget,
    });

    this.addDeterministicExploration({
      selected,
      allValid,
      searchBudget,
    });

    const trios = [...selected.values()]
      .sort((a, b) => b.heuristicScore - a.heuristicScore)
      .slice(0, searchBudget);

    return {
      trios,
      stats: {
        totalPossible,
        validGenerated: allValid.length,
        selectedForPipeline: trios.length,
        skippedInvalid,
      },
    };
  }

  private addAnchorCoverage(params: {
    selected: Map<string, OptimizedTrioCandidate>;
    allValid: OptimizedTrioCandidate[];
    candidates: PokemonData[];
    searchBudget: number;
  }): void {
    const { selected, allValid, candidates, searchBudget } = params;
    const anchors = candidates.slice(0, Math.min(this.options.anchorCandidateLimit, candidates.length));
    const perAnchor = this.options.perAnchorCombinations;

    for (const anchor of anchors) {
      if (selected.size >= searchBudget) return;

      let addedForAnchor = 0;

      for (const trio of allValid) {
        if (selected.size >= searchBudget || addedForAnchor >= perAnchor) break;

        if (trio.trio.some(pokemon => pokemon.name === anchor.name)) {
          selected.set(trio.signature, trio);
          addedForAnchor++;
        }
      }
    }
  }

  private addDeterministicExploration(params: {
    selected: Map<string, OptimizedTrioCandidate>;
    allValid: OptimizedTrioCandidate[];
    searchBudget: number;
  }): void {
    const { selected, allValid, searchBudget } = params;
    const remainingBudget = searchBudget - selected.size;

    if (remainingBudget <= 0) return;

    const stride = Math.max(1, Math.floor(allValid.length / remainingBudget));

    for (let index = stride; index < allValid.length; index += stride) {
      if (selected.size >= searchBudget) return;

      const trio = allValid[index];
      selected.set(trio.signature, trio);
    }

    for (const trio of allValid) {
      if (selected.size >= searchBudget) return;
      selected.set(trio.signature, trio);
    }
  }

  private calculateHeuristicScore(
    trio: PokemonData[],
    params: FindBestTriosParams,
  ): number {
    const { baseTeam, format, candidateProfiles = {}, teamIdentity = 'balanced' } = params;

    let score = trio.reduce(
      (sum, pokemon) => sum + (candidateProfiles[pokemon.name]?.score ?? 0),
      0,
    );

    const fullTeam = [...baseTeam, ...trio];
    const uniqueTypes = new Set<string>();
    const allTypes: string[] = [];
    const roles = new Set<string>();
    const speeds: number[] = [];

    for (const pokemon of fullTeam) {
      const profile = candidateProfiles[pokemon.name];
      const types = profile?.types?.length ? profile.types : getPokemonTypes(pokemon, format);

      for (const type of types) {
        uniqueTypes.add(type);
        allTypes.push(type);
      }

      const resolvedRoles = profile?.roles?.length
        ? profile.roles
        : pokemon.competitive?.roles ?? [];

      for (const role of resolvedRoles) {
        roles.add(role);
      }

      const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
      if (speed > 0) speeds.push(speed);
    }

    score += uniqueTypes.size * 3.5;
    score += roles.size * 3;
    score -= this.calculateRepeatedTypePenalty(allTypes);

    const fastest = speeds.length > 0 ? Math.max(...speeds) : 0;
    const averageSpeed = speeds.length > 0
      ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
      : 0;

    if (fastest >= 120) score += 10;
    else if (fastest >= 105) score += 7;
    else if (fastest >= 95) score += 4;

    if (averageSpeed >= 85 && averageSpeed <= 105) score += 4;
    if (averageSpeed < 65 && teamIdentity !== 'stall') score -= 6;

    score += this.calculateIdentityHeuristicBonus({
      teamIdentity,
      roles,
      fastest,
      averageSpeed,
      trio,
      format,
    });

    if (this.radicalRedScorer.isApplicable(format)) {
      const gauntlet = this.radicalRedScorer.scoreTeam(fullTeam, format);
      const gauntletObjective =
        gauntlet.worstBossScore * 2.35 +
        gauntlet.consistencyScore * 1.85 +
        gauntlet.averageBossScore * 0.85 -
        gauntlet.criticalThreatCount * 22;

      score = score * 0.35 + gauntletObjective;
    }

    if (this.championsScorer.isApplicable(format)) {
      const regulation = this.championsScorer.scoreTeam(fullTeam, format);
      const regulationObjective =
        regulation.score * 2.1 +
        regulation.roleCoverage.threatCoverage * 1.35 +
        regulation.roleCoverage.speedControl * 1.15 +
        regulation.roleCoverage.roleCompression * 1.05 +
        regulation.roleCoverage.fieldControl * (regulation.battleStyle === 'doubles' ? 1.25 : 0.55) +
        regulation.roleCoverage.megaReadiness * 0.75;

      score = score * 0.42 + regulationObjective;
    }

    return score;
  }

  private calculateIdentityHeuristicBonus(params: {
    teamIdentity: string;
    roles: Set<string>;
    fastest: number;
    averageSpeed: number;
    trio: PokemonData[];
    format: string;
  }): number {
    const { teamIdentity, roles, fastest, averageSpeed, trio, format } = params;
    const offensivePower = trio.reduce((sum, pokemon) => {
      const stats = getVariant(pokemon, format)?.baseStats;
      return sum + Math.max(Number(stats?.atk ?? 0), Number(stats?.spa ?? 0));
    }, 0) / Math.max(1, trio.length);

    const defensivePower = trio.reduce((sum, pokemon) => {
      const stats = getVariant(pokemon, format)?.baseStats;
      return sum + Number(stats?.hp ?? 0) + Number(stats?.def ?? 0) + Number(stats?.spd ?? 0);
    }, 0) / Math.max(1, trio.length);

    switch (teamIdentity) {
      case 'hyper_offense':
        return (fastest >= 110 ? 10 : 0) + (offensivePower >= 115 ? 10 : 0);
      case 'bulky_offense':
        return (offensivePower >= 105 ? 7 : 0) + (defensivePower >= 260 ? 7 : 0);
      case 'stall':
        return (defensivePower >= 285 ? 12 : 0) + (roles.has('Physical Wall') ? 5 : 0) + (roles.has('Special Wall') ? 5 : 0);
      case 'speed':
        return fastest >= 120 ? 14 : fastest >= 105 ? 8 : 0;
      case 'fun':
        return trio.some(pokemon => pokemon.name.toLowerCase().includes('-mega')) ? -6 : 4;
      case 'balanced':
      default:
        return (averageSpeed >= 75 ? 4 : 0) + (roles.size >= 4 ? 6 : 0);
    }
  }

  private calculateRepeatedTypePenalty(types: string[]): number {
    const counts = new Map<string, number>();

    for (const type of types) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    let penalty = 0;

    for (const count of counts.values()) {
      if (count > 2) {
        penalty += (count - 2) * 4;
      }
    }

    return penalty;
  }

  private isValidTeam(team: PokemonData[], baseTeam: PokemonData[], format: string): boolean {
    const names = new Set(team.map(pokemon => pokemon.name));
    if (names.size !== team.length) {
      return false;
    }

    const megaCount = team.filter(pokemon =>
      pokemon.name.toLowerCase().includes('-mega'),
    ).length;

    if (megaCount > 1) {
      return false;
    }

    // Filtra se introduziu um novo conflito que o baseTeam não tinha
    const baseHasConflict = this.hasConflict(baseTeam, format);
    if (!baseHasConflict && this.hasConflict(team, format)) {
      return false;
    }

    return true;
  }

  private hasConflict(team: PokemonData[], format: string): boolean {
    // 1. Climas conflituosos (gerador vs gerador de climas diferentes ou gerador vs abusador de clima diferente)
    const weatherSetters = new Set<string>();
    const weatherAbusers = new Set<string>();
    const weatherTypes = [
      { setters: ['drizzle', 'primordialsea'], beneficiaries: ['swiftswim', 'raindish', 'dryskin', 'hydration'], name: 'Chuva' },
      { setters: ['drought', 'orichalcumpulse', 'desolateland'], beneficiaries: ['chlorophyll', 'solarpower', 'protosynthesis', 'flowergift', 'harvest'], name: 'Sol' },
      { setters: ['sandstream', 'sandspit'], beneficiaries: ['sandrush', 'sandforce', 'sandveil', 'overcoat'], name: 'Areia' },
      { setters: ['snowwarning'], beneficiaries: ['slushrush', 'icebody', 'snowcloak'], name: 'Neve' }
    ];



    for (const w of weatherTypes) {
      for (const p of team) {
        if (this.checkAbility(p, w.setters, format)) {
          weatherSetters.add(w.name);
        }
        if (this.checkAbility(p, w.beneficiaries, format)) {
          weatherAbusers.add(w.name);
        }
      }
    }

    if (weatherSetters.size >= 2) return true; // Conflito de 2+ geradores
    for (const setter of weatherSetters) {
      for (const abuser of weatherAbusers) {
        if (setter !== abuser) return true; // Gerador vs Abusador de outro clima
      }
    }

    // 2. Terrenos conflituosos
    const terrainSetters = new Set<string>();
    const terrainAbusers = new Set<string>();
    const terrainTypes = [
      { setters: ['psychicsurge'], beneficiaries: ['expandingforce'], name: 'Terreno Psíquico' },
      { setters: ['grassysurge'], beneficiaries: ['grassglide'], name: 'Terreno de Grama' },
      { setters: ['electricsurge'], beneficiaries: ['risingvoltage', 'quarkdrive'], name: 'Terreno Elétrico' },
      { setters: ['mistysurge'], beneficiaries: ['mistyexplosion'], name: 'Terreno de Névoa' }
    ];

    for (const t of terrainTypes) {
      for (const p of team) {
        if (this.checkAbility(p, t.setters, format)) {
          terrainSetters.add(t.name);
        }
        if (this.checkAbility(p, t.beneficiaries, format) || this.checkMove(p, t.beneficiaries)) {
          terrainAbusers.add(t.name);
        }
      }
    }

    if (terrainSetters.size >= 2) return true; // Conflito de 2+ geradores de terreno
    for (const setter of terrainSetters) {
      for (const abuser of terrainAbusers) {
        if (setter !== abuser) return true; // Gerador vs Abusador de outro terreno
      }
    }

    return false;
  }

  private checkAbility(pokemon: PokemonData, names: string[], format: string): boolean {
    const targetNames = names.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Quando temos a habilidade ativa do set, ela é definitiva — não verificar outras possíveis
    if (pokemon.ability) {
      const norm = pokemon.ability.toLowerCase().replace(/[^a-z0-9]/g, '');
      return targetNames.includes(norm);
    }

    // Sem habilidade ativa definida: consultar o variant do formato
    const variant = getVariant(pokemon, format);
    if (variant?.abilities) {
      for (const key in variant.abilities) {
        const val = variant.abilities[key];
        if (typeof val === 'string') {
          const norm = val.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (targetNames.includes(norm)) return true;
        }
      }
      return false;
    }

    // Último recurso: habilidade principal do banco (apenas slot "0", nunca a oculta)
    if (pokemon.abilities?.['0']) {
      const norm = (pokemon.abilities['0'] as string).toLowerCase().replace(/[^a-z0-9]/g, '');
      return targetNames.includes(norm);
    }

    return false;
  }

  private checkMove(pokemon: PokemonData, names: string[]): boolean {
    if (!pokemon.moves) return false;
    const targetNames = names.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return pokemon.moves.some(move => {
      const norm = move.toLowerCase().replace(/[^a-z0-9]/g, '');
      return targetNames.includes(norm);
    });
  }

  private insertIfRelevant(
    best: EvaluatedCombination[],
    item: EvaluatedCombination,
  ): void {
    if (best.length < this.maxToKeep) {
      best.push(item);
      return;
    }

    let worstIndex = 0;

    for (let i = 1; i < best.length; i++) {
      if (this.compareCombinations(best[i], best[worstIndex]) > 0) {
        worstIndex = i;
      }
    }

    if (this.compareCombinations(item, best[worstIndex]) < 0) {
      best[worstIndex] = item;
    }
  }

  private compareCombinations(
    a: EvaluatedCombination,
    b: EvaluatedCombination,
  ): number {
    const statsA = a.context.analysis;
    const statsB = b.context.analysis;

    const gauntletA = a.context.analysis.radicalRedGauntlet;
    const gauntletB = b.context.analysis.radicalRedGauntlet;

    if (gauntletA && gauntletB) {
      if (gauntletA.worstBossScore !== gauntletB.worstBossScore) {
        return gauntletB.worstBossScore - gauntletA.worstBossScore;
      }

      if (gauntletA.criticalThreats.length !== gauntletB.criticalThreats.length) {
        return gauntletA.criticalThreats.length - gauntletB.criticalThreats.length;
      }

      if (gauntletA.consistencyScore !== gauntletB.consistencyScore) {
        return gauntletB.consistencyScore - gauntletA.consistencyScore;
      }

      if (gauntletA.averageBossScore !== gauntletB.averageBossScore) {
        return gauntletB.averageBossScore - gauntletA.averageBossScore;
      }
    }

    const regulationA = a.context.analysis.championsRegulation;
    const regulationB = b.context.analysis.championsRegulation;

    if (regulationA && regulationB) {
      if (regulationA.score !== regulationB.score) {
        return regulationB.score - regulationA.score;
      }

      if (regulationA.roleCoverage.threatCoverage !== regulationB.roleCoverage.threatCoverage) {
        return regulationB.roleCoverage.threatCoverage - regulationA.roleCoverage.threatCoverage;
      }

      if (regulationA.roleCoverage.speedControl !== regulationB.roleCoverage.speedControl) {
        return regulationB.roleCoverage.speedControl - regulationA.roleCoverage.speedControl;
      }
    }

    if (a.context.score.total !== b.context.score.total) {
      return b.context.score.total - a.context.score.total;
    }

    if (statsA.fatalUncovered !== statsB.fatalUncovered) {
      return statsA.fatalUncovered - statsB.fatalUncovered;
    }

    if (statsA.normalUncovered !== statsB.normalUncovered) {
      return statsA.normalUncovered - statsB.normalUncovered;
    }

    return statsA.totalWeaknesses - statsB.totalWeaknesses;
  }

  private getSignature(team: PokemonData[]): string {
    return team
      .map(pokemon => {
        const setSuffix = pokemon.ability || pokemon.item ? `-${pokemon.ability || ''}-${pokemon.item || ''}` : '';
        return `${pokemon.name}${setSuffix}`;
      })
      .sort()
      .join('|');
  }

  private combinationCount(total: number, choose: number): number {
    if (choose > total) return 0;
    if (choose === 3) return (total * (total - 1) * (total - 2)) / 6;

    let numerator = 1;
    let denominator = 1;

    for (let i = 0; i < choose; i++) {
      numerator *= total - i;
      denominator *= i + 1;
    }

    return numerator / denominator;
  }
}
