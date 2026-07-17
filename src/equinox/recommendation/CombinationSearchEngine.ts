import { AnalysisContext, PokemonData } from '../core/AnalysisContext';
import { AnalysisPipeline } from '../core/AnalysisPipeline';
import { getPokemonTypes, getSpeciesClauseKey, getVariant } from '../utils/PokemonUtils';
import { RadicalRedGauntletScorer } from '../radicalred/RadicalRedGauntletScorer';
import { ChampionsRegulationScorer } from '../champions/ChampionsRegulationScorer';
import {
  evaluateVgcTeamPlan,
  hasActiveSunSetterForVgc,
  isLikelyTrickRoomAbuserForVgc,
  hasLikelyTrickRoomCoreForVgc,
  hasPrimarySunAbuserForVgc,
  isLikelyRedirectionSupportForVgc,
  isLikelyTrickRoomSetterForVgc,
  isPremiumTrickRoomRedirectionForVgc,
} from '../vgc/VgcTeamBuilding';
import { evaluateVgcArchetypeCompatibility, evaluateVgcMechanicBlueprint } from '../vgc/VgcArchetypeBlueprints';
import { isAbilityLegalForPokemon, isMegaOption } from '../utils/VgcSetOptimizer';
import {
  hasTerrainSleepConflict,
  isVgcMechanicTerrainAbuser,
  isVgcMechanicTerrainSetter,
  isVgcMechanicWeatherAbuser,
  isVgcMechanicWeatherSetter,
} from '../vgc/VgcMechanicProfiles';
import type { FormatSolver } from '../format-solvers/FormatSolver';
import { FormatSolverRegistry } from '../format-solvers/FormatSolverRegistry';
import { evaluateFormatTeamObjective } from '../format-solvers/FormatObjectiveGuards';

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
  formatSolver?: FormatSolver;
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

  /**
   * Wall-clock budget (ms) for the O(n³) pre-filter loop that scores every
   * valid trio before maxPipelineEvaluations is applied. A candidate-count
   * cap was tried first and reverted: truncating to the top-N scored
   * candidates can produce a pool too homogeneous to satisfy composition
   * constraints (real incident: the 12 top-scoring candidates for a
   * rain-biased team were all Water-type, making it impossible to find any
   * trio under the "max 3 Water-types" rule). A time budget instead lets
   * the loop reach more diverse candidates further down the list, and
   * adapts to whatever the CPU is actually doing right now instead of a
   * fixed guess. Combined with periodic yieldEventLoop() calls so Render's
   * health check isn't starved. The loop keeps whatever valid trios it
   * found so far when the budget runs out.
   */
  maxPreFilterTimeMs: number;

  /**
   * Same idea as maxPreFilterTimeMs, but for the second phase: running the
   * full analysis pipeline on up to maxPipelineEvaluations trios. That
   * phase only had a count budget before, with no time bound — under CPU
   * throttling each pipeline run can be as expensive as pré-filtro work,
   * so it needs the same wall-clock safety net.
   */
  maxPipelineTimeMs: number;
}

interface OptimizedTrioCandidate {
  trio: PokemonData[];
  signature: string;
  heuristicScore: number;
}

interface OptimizedQuartetCandidate {
  quartet: PokemonData[];
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
  private readonly solverRegistry = new FormatSolverRegistry();
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
      maxPreFilterTimeMs: options?.maxPreFilterTimeMs ?? Infinity,
      maxPipelineTimeMs: options?.maxPipelineTimeMs ?? Infinity,
    };
  }

  public async findBestComplements(
    params: FindBestTriosParams,
  ): Promise<EvaluatedCombination[]> {
    if (params.baseTeam.length === 2) {
      return this.findBestQuartets(params);
    }
    return this.findBestTrios(params);
  }

  public async findBestTrios(
    params: FindBestTriosParams,
  ): Promise<EvaluatedCombination[]> {
    const { baseTeam, candidates, format, teamIdentity = 'balanced' } = params;
    const formatSolver = params.formatSolver ?? this.solverRegistry.getSolver(format);
    const best: EvaluatedCombination[] = [];

    const { trios, stats } = await this.buildOptimizedSearchSpace(params);

    console.log(
      `[Equinox] CombinationOptimizer: possible=${stats.totalPossible}, valid=${stats.validGenerated}, evaluated=${stats.selectedForPipeline}, skippedInvalid=${stats.skippedInvalid}, exploitation=${this.options.exploitationRatio}, anchors=${this.options.anchorCandidateLimit}x${this.options.perAnchorCombinations}`,
    );

    const pipelineDeadline = Date.now() + this.options.maxPipelineTimeMs;
    let pipelineIterations = 0;

    for (const candidate of trios) {
      if (Date.now() > pipelineDeadline) {
        console.log(
          `[Equinox] CombinationOptimizer: pipeline completo interrompido por orçamento de tempo (${this.options.maxPipelineTimeMs}ms) com ${best.length} times avaliados até então.`,
        );
        break;
      }

      // Cede o event loop periodicamente para que o health check do Render
      // (timeout de 5s) consiga responder mesmo com o pipeline em andamento
      // — sem isso, a instância é derrubada no meio da requisição.
      if (++pipelineIterations % 5 === 0) {
        await this.yieldEventLoop();
      }

      const fullTeam = formatSolver.normalizeFinalTeam([...baseTeam, ...candidate.trio], format);
      const normalizedTrio = fullTeam.slice(baseTeam.length);

      const context = new AnalysisContext({
        format,
        selectedPokemon: fullTeam,
        candidatePool: candidates,
        teamIdentity,
      });

      await this.pipeline.run(context);

      this.insertIfRelevant(best, {
        team: normalizedTrio,
        context,
      });
    }

    return best.sort(this.compareCombinations);
  }

  /**
   * Cede o controle ao event loop (setImmediate, não apenas um microtask) —
   * necessário para que o health check HTTP do Render consiga ser atendido
   * durante um laço síncrono longo. Um `await` de uma Promise já resolvida
   * não basta: isso só processa microtasks, nunca a fila de I/O/timers onde
   * o health check está esperando.
   */
  private yieldEventLoop(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }

  private async buildOptimizedSearchSpace(
    params: FindBestTriosParams,
  ): Promise<{ trios: OptimizedTrioCandidate[]; stats: OptimizerStats }> {
    const { baseTeam, candidates, format } = params;
    const formatSolver = params.formatSolver ?? this.solverRegistry.getSolver(format);
    // Sem teto de contagem aqui: os candidatos já vêm ordenados por
    // relevância (DiversityCandidateSelector), e cortar para os N
    // primeiros pode produzir um pool homogêneo demais para satisfazer
    // restrições de composição (ex.: incidente real 2026-07-17 — os 12
    // candidatos mais bem pontuados para um time com viés de chuva eram
    // TODOS do tipo Water, tornando impossível achar qualquer trio válido
    // sob o limite de "no máximo 3 Water-types"). maxPreFilterTimeMs é o
    // limite real de latência; não precisa de um teto de contagem também.
    const len = candidates.length;
    const totalPossible = this.combinationCount(len, 3);
    const allValid: OptimizedTrioCandidate[] = [];
    let skippedInvalid = 0;
    let timedOut = false;
    let iterations = 0;
    const deadline = Date.now() + this.options.maxPreFilterTimeMs;

    outer: for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        for (let k = j + 1; k < len; k++) {
          if (Date.now() > deadline) {
            timedOut = true;
            break outer;
          }

          if (++iterations % 25 === 0) {
            await this.yieldEventLoop();
          }

          const trio = [candidates[i], candidates[j], candidates[k]];
          const trioSpecies = new Set(trio.map(pokemon => getSpeciesClauseKey(pokemon.name)));
          if (trioSpecies.size !== trio.length) {
            skippedInvalid++;
            continue;
          }

          const fullTeam = formatSolver.normalizeFinalTeam([...baseTeam, ...trio], format);

          if (!this.isValidTeam(fullTeam, baseTeam, format, formatSolver)) {
            skippedInvalid++;
            continue;
          }

          allValid.push({
            trio,
            signature: this.getSignature(trio),
            heuristicScore: this.calculateHeuristicScore(trio, params, formatSolver),
          });
        }
      }
    }

    if (timedOut) {
      console.log(
        `[Equinox] CombinationOptimizer: pré-filtro interrompido por orçamento de tempo (${this.options.maxPreFilterTimeMs}ms) com ${allValid.length} trios válidos encontrados até então.`,
      );
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
    formatSolver: FormatSolver,
  ): number {
    const { baseTeam, format, candidateProfiles = {}, teamIdentity = 'balanced' } = params;

    let score = trio.reduce(
      (sum, pokemon) => sum + (candidateProfiles[pokemon.name]?.score ?? 0),
      0,
    );

    const fullTeam = [...baseTeam, ...trio];
    const baseHasSunSetter = baseTeam.some(pokemon => hasActiveSunSetterForVgc(pokemon, format));
    const baseHasPrimarySunAbuser = baseTeam.some(pokemon => hasPrimarySunAbuserForVgc(pokemon, format));
    const fullHasPrimarySunAbuser = fullTeam.some(pokemon => hasPrimarySunAbuserForVgc(pokemon, format));
    const baseHasLikelyTrickRoomCore = hasLikelyTrickRoomCoreForVgc(baseTeam, format);
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

    const weightUniqueTypes = teamIdentity === 'creative' ? 14.0 : 3.5;
    const weightRoles = teamIdentity === 'creative' ? 8.0 : 3.0;
    const weightRepeatedPenalty = teamIdentity === 'creative' ? 6.5 : 1.0;

    score += uniqueTypes.size * weightUniqueTypes;
    score += roles.size * weightRoles;
    score -= this.calculateRepeatedTypePenalty(allTypes) * weightRepeatedPenalty;

    // Se for ofensivo, penalizar severamente acúmulo de suportes no trio para favorecer sweepers
    if (teamIdentity === 'offensive') {
      const supportCount = trio.filter(p => p.competitive?.roles?.includes('Support') || p.competitive?.roles?.includes('Pivot')).length;
      if (supportCount >= 2) score -= 80;
    }

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
      baseTeam,
    });

    if (formatSolver.usesDoublesMechanicContracts) {
      if (baseHasSunSetter && !baseHasPrimarySunAbuser && !baseHasLikelyTrickRoomCore) {
        score += fullHasPrimarySunAbuser ? 180 : -260;
      }

      const vgcPlan = evaluateVgcTeamPlan(fullTeam, format);
      const mechanicContract = evaluateVgcMechanicBlueprint(fullTeam, format, vgcPlan.archetype.id);
      const architectureCompatibility = evaluateVgcArchetypeCompatibility(fullTeam, format, vgcPlan.archetype.id);
      const weightPlan = teamIdentity === 'creative' ? 0.8 : 2.0;
      const weightContract = teamIdentity === 'creative' ? 0.7 : 2.1;
      score += (vgcPlan.score - 50) * weightPlan;
      score += (mechanicContract.score - 50) * weightContract;
      score += architectureCompatibility.score;
      score += Math.min(30, vgcPlan.modeAnalysis.viableModeCount * 6);

      const penaltyScale = teamIdentity === 'creative' ? 0.4 : 1.0;
      score -= vgcPlan.roleCoverage.missingCriticalRoles.length * 12 * penaltyScale;
      score -= mechanicContract.missingCriticalMechanics.length * 45 * penaltyScale;
      score -= mechanicContract.conflictWarnings.length * 24 * penaltyScale;
      score -= architectureCompatibility.hardFailures.length * 95 * penaltyScale;
      score -= architectureCompatibility.warnings.length * 32 * penaltyScale;
      score -= vgcPlan.roleCoverage.redundancyWarnings.length * 6 * penaltyScale;

      if (baseHasLikelyTrickRoomCore) {
        const hasPremiumTrickRoomRedirection = fullTeam.some(pokemon => isPremiumTrickRoomRedirectionForVgc(pokemon));
        const hasAnyRedirection = fullTeam.some(pokemon => isLikelyRedirectionSupportForVgc(pokemon));
        const trickRoomSetterCount = fullTeam.filter(pokemon => isLikelyTrickRoomSetterForVgc(pokemon)).length;
        const trickRoomAbuserCount = fullTeam.filter(pokemon => isLikelyTrickRoomAbuserForVgc(pokemon, format)).length;
        const fastNonTrickRoomPieces = fullTeam.filter(pokemon => {
          const key = pokemon.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const speed = Number(getVariant(pokemon, format)?.baseStats?.spe ?? 0);
          return speed >= 90 &&
            !isLikelyTrickRoomAbuserForVgc(pokemon, format) &&
            !isLikelyRedirectionSupportForVgc(pokemon) &&
            !['farigiraf'].includes(key);
        }).length;
        const disfavoredFastSetup = fullTeam.filter(pokemon => /volcarona|dragonite|salamence|gyarados/i.test(pokemon.name)).length;
        const fireMembers = fullTeam.filter(pokemon => getPokemonTypes(pokemon, format).some(type => type.toLowerCase() === 'fire')).length;

        if (hasPremiumTrickRoomRedirection) score += 180;
        else if (hasAnyRedirection) score += 55;
        else score -= 340;

        if (trickRoomSetterCount >= 2) score += 70;
        if (trickRoomAbuserCount >= 3) score += 55;

        const speedPenaltyWeight = (teamIdentity === 'offensive' || teamIdentity === 'creative') ? 15 : 60;
        if (fastNonTrickRoomPieces > 0) score -= fastNonTrickRoomPieces * speedPenaltyWeight;
        if (disfavoredFastSetup > 0) score -= disfavoredFastSetup * 75;
        if (fireMembers >= 3) score -= 80;
      }
    }

    const formatObjective = evaluateFormatTeamObjective({
      mode: formatSolver.mode,
      baseTeam,
      team: fullTeam,
      format,
    });
    score += formatObjective.score;
    score -= formatObjective.hardFailures.length * 600;
    score -= formatObjective.warnings.length * 80;

    if (formatSolver.mode === 'radical_red') {
      const gauntlet = this.radicalRedScorer.scoreTeam(fullTeam, format);
      const gauntletObjective =
        gauntlet.worstBossScore * 2.35 +
        gauntlet.consistencyScore * 1.85 +
        gauntlet.averageBossScore * 0.85 -
        gauntlet.criticalThreatCount * 22;

      score = score * 0.35 + gauntletObjective;
    }

    const championsProfile = this.championsScorer.getProfile(format);
    if (formatSolver.mode === 'champions_singles' && championsProfile && championsProfile.battleStyle !== 'doubles') {
      const regulation = this.championsScorer.scoreTeam(fullTeam, format);
      const regulationObjective =
        regulation.score * 2.1 +
        regulation.roleCoverage.threatCoverage * 1.35 +
        regulation.roleCoverage.speedControl * 1.15 +
        regulation.roleCoverage.roleCompression * 1.05 +
        regulation.roleCoverage.fieldControl * 0.55 +
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
    baseTeam: PokemonData[];
  }): number {
    const { teamIdentity, roles, fastest, averageSpeed, trio, format, baseTeam } = params;
    const offensivePower = trio.reduce((sum, pokemon) => {
      const stats = getVariant(pokemon, format)?.baseStats;
      return sum + Math.max(Number(stats?.atk ?? 0), Number(stats?.spa ?? 0));
    }, 0) / Math.max(1, trio.length);

    const defensivePower = trio.reduce((sum, pokemon) => {
      const stats = getVariant(pokemon, format)?.baseStats;
      return sum + Number(stats?.hp ?? 0) + Number(stats?.def ?? 0) + Number(stats?.spd ?? 0);
    }, 0) / Math.max(1, trio.length);

    switch (teamIdentity) {
      case 'offensive': {
        let bonus = 0;
        if (offensivePower >= 110) bonus += 50;
        else if (offensivePower >= 95) bonus += 25;
        if (fastest >= 95) bonus += 25;
        const supportMon = trio.filter(p => p.competitive?.roles?.includes('Pivot') || p.competitive?.roles?.includes('Support')).length;
        if (supportMon >= 2) bonus -= 30;
        return bonus;
      }
      case 'defensive': {
        let bonus = 0;
        if (defensivePower >= 260) bonus += 50;
        else if (defensivePower >= 240) bonus += 25;
        const hasSupport = trio.some(p => p.competitive?.roles?.includes('Pivot') || p.competitive?.roles?.includes('Support') || p.competitive?.roles?.includes('Special Wall') || p.competitive?.roles?.includes('Physical Wall'));
        if (hasSupport) bonus += 25;
        return bonus;
      }
      case 'anti-meta':
      case 'anti_meta': {
        let bonus = 0;
        const hasAntiMetaAbility = trio.some(p => {
          const ability = (p.ability || '').toLowerCase();
          return ['inner focus', 'defiant', 'competitive', 'clear body', 'armor tail', 'ghost'].includes(ability) ||
                  getPokemonTypes(p, format).some((t: string) => t.toLowerCase() === 'ghost');
        });
        if (hasAntiMetaAbility) bonus += 45;
        return bonus;
      }
      case 'creative': {
        let bonus = 0;
        const topMeta = ['incineroar', 'rillaboom', 'urshifu', 'flutter mane', 'amoonguss', 'pelipper', 'sinistcha', 'tornadus', 'chiyu', 'chienpao'];
        const creativeMons = trio.filter(p => !topMeta.includes(p.name.toLowerCase()));
        bonus += creativeMons.length * 45;

        const uniqueTypes = new Set(trio.flatMap(p => getPokemonTypes(p, format)));
        const baseTypes = new Set(baseTeam.flatMap(p => getPokemonTypes(p, format)));
        let newTypesCount = 0;
        for (const t of uniqueTypes) {
          if (!baseTypes.has(t)) newTypesCount++;
        }
        bonus += newTypesCount * 25;

        return bonus;
      }
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

  private isValidTeam(team: PokemonData[], baseTeam: PokemonData[], format: string, formatSolver: FormatSolver): boolean {
    const names = new Set(team.map(pokemon => getSpeciesClauseKey(pokemon.name)));
    if (names.size !== team.length) {
      return false;
    }

    const megaCount = team.filter(pokemon => isMegaOption(pokemon)).length;
    if (megaCount > 1) {
      return false;
    }

    if (team.some(pokemon => !isAbilityLegalForPokemon(pokemon, format, pokemon.ability))) {
      return false;
    }

    if (formatSolver.usesItemClause) {
      const teamItems = team.map(p => p.item).filter(Boolean) as string[];
      if (teamItems.length > 0 && new Set(teamItems).size < teamItems.length) {
        const baseItems = baseTeam.map(p => p.item).filter(Boolean) as string[];
        const baseHasItemDuplicate = new Set(baseItems).size < baseItems.length;
        if (!baseHasItemDuplicate) {
          console.log('[DEBUG-REJECT] Item Clause violada:', teamItems);
          return false;
        }
      }
    }

    if (formatSolver.usesDoublesMechanicContracts) {
      const baseHasConflict = this.hasConflict(baseTeam, format);
      if (!baseHasConflict && this.hasConflict(team, format)) {
        console.log('[DEBUG-REJECT] Conflito de eixos na equipe inteira');
        return false;
      }

      const baseHasSunSetter = baseTeam.some(pokemon => hasActiveSunSetterForVgc(pokemon, format));
      const baseHasPrimarySunAbuser = baseTeam.some(pokemon => hasPrimarySunAbuserForVgc(pokemon, format));
      const teamHasPrimarySunAbuser = team.some(pokemon => hasPrimarySunAbuserForVgc(pokemon, format));
      const baseHasLikelyTrickRoomCore = hasLikelyTrickRoomCoreForVgc(baseTeam, format);

      if (baseHasSunSetter && !baseHasPrimarySunAbuser && !teamHasPrimarySunAbuser && !baseHasLikelyTrickRoomCore) {
        console.log('[DEBUG-REJECT] Sun core inválido');
        return false;
      }
    }

    const validation = formatSolver.validateFinalTeam(team, format);
    if (!validation.valid) {
      console.log('[DEBUG-REJECT] validateFinalTeam inválido:', validation.hardFailures);
      return false;
    }

    const objective = evaluateFormatTeamObjective({
      mode: formatSolver.mode,
      baseTeam,
      team,
      format,
    });

    if (objective.hardFailures.length > 0) {
      console.log('[DEBUG-REJECT] objective.hardFailures:', objective.hardFailures);
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
        if (this.checkAbility(p, w.setters, format) || this.isMechanicWeatherForName(p, w.name, 'setter')) {
          weatherSetters.add(w.name);
        }
        if (this.checkAbility(p, w.beneficiaries, format) || this.isMechanicWeatherForName(p, w.name, 'abuser')) {
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
        if (this.checkAbility(p, t.setters, format) || this.isMechanicTerrainForName(p, t.name, 'setter')) {
          terrainSetters.add(t.name);
        }
        if (this.checkAbility(p, t.beneficiaries, format) || this.checkMove(p, t.beneficiaries) || this.isMechanicTerrainForName(p, t.name, 'abuser')) {
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

    if (hasTerrainSleepConflict(team)) return true; // Electric/Misty Terrain enfraquece planos baseados em sono

    return false;
  }

  private isMechanicWeatherForName(pokemon: PokemonData, label: string, role: 'setter' | 'abuser'): boolean {
    const weatherByLabel: Record<string, 'sun' | 'rain' | 'sand' | 'snow'> = {
      'Sol': 'sun',
      'Chuva': 'rain',
      'Areia': 'sand',
      'Neve': 'snow',
    };
    const weather = weatherByLabel[label];
    if (!weather) return false;
    return role === 'setter'
      ? isVgcMechanicWeatherSetter(pokemon, weather)
      : isVgcMechanicWeatherAbuser(pokemon, weather);
  }

  private isMechanicTerrainForName(pokemon: PokemonData, label: string, role: 'setter' | 'abuser'): boolean {
    const terrainByLabel: Record<string, 'psychic' | 'grassy' | 'electric' | 'misty'> = {
      'Terreno Psíquico': 'psychic',
      'Terreno de Grama': 'grassy',
      'Terreno Elétrico': 'electric',
      'Terreno de Névoa': 'misty',
    };
    const terrain = terrainByLabel[label];
    if (!terrain) return false;
    return role === 'setter'
      ? isVgcMechanicTerrainSetter(pokemon, terrain)
      : isVgcMechanicTerrainAbuser(pokemon, terrain);
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

    const vgcPlanA = a.context.analysis.vgcTeamPlan;
    const vgcPlanB = b.context.analysis.vgcTeamPlan;

    if (a.context.teamIdentity === 'creative' || a.context.teamIdentity === 'fun') {
      const topMeta = ['incineroar', 'rillaboom', 'urshifu', 'flutter mane', 'amoonguss', 'pelipper', 'sinistcha', 'tornadus', 'chiyu', 'chienpao', 'togekiss'];
      const offMetaA = a.team.filter(p => !topMeta.includes(p.name.toLowerCase())).length;
      const offMetaB = b.team.filter(p => !topMeta.includes(p.name.toLowerCase())).length;
      if (offMetaA !== offMetaB) {
        return offMetaB - offMetaA;
      }
    }

    if (vgcPlanA && vgcPlanB) {
      const missingMechanicsA = vgcPlanA.mechanicCoverage?.missingCriticalMechanics?.length ?? 0;
      const missingMechanicsB = vgcPlanB.mechanicCoverage?.missingCriticalMechanics?.length ?? 0;

      if (missingMechanicsA !== missingMechanicsB) {
        return missingMechanicsA - missingMechanicsB;
      }

      const missingA = vgcPlanA.roleCoverage.missingCriticalRoles.length;
      const missingB = vgcPlanB.roleCoverage.missingCriticalRoles.length;

      if (missingA !== missingB) {
        return missingA - missingB;
      }

      if (Math.abs((vgcPlanA.mechanicCoverage?.score ?? 0) - (vgcPlanB.mechanicCoverage?.score ?? 0)) >= 2) {
        return (vgcPlanB.mechanicCoverage?.score ?? 0) - (vgcPlanA.mechanicCoverage?.score ?? 0);
      }

      if (Math.abs(vgcPlanA.score - vgcPlanB.score) >= 2) {
        return vgcPlanB.score - vgcPlanA.score;
      }

      if (vgcPlanA.modeAnalysis.viableModeCount !== vgcPlanB.modeAnalysis.viableModeCount) {
        return vgcPlanB.modeAnalysis.viableModeCount - vgcPlanA.modeAnalysis.viableModeCount;
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
        return `${getSpeciesClauseKey(pokemon.name)}${setSuffix}`;
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

  public async findBestQuartets(
    params: FindBestTriosParams,
  ): Promise<EvaluatedCombination[]> {
    const { baseTeam, candidates, format, teamIdentity = 'balanced' } = params;
    const formatSolver = params.formatSolver ?? this.solverRegistry.getSolver(format);
    const best: EvaluatedCombination[] = [];

    const { quartets, stats } = this.buildOptimizedQuartetSearchSpace(params);

    console.log(
      `[Equinox] CombinationOptimizer (Quartets): possible=${stats.totalPossible}, valid=${stats.validGenerated}, evaluated=${stats.selectedForPipeline}, skippedInvalid=${stats.skippedInvalid}`,
    );

    for (const candidate of quartets) {
      const fullTeam = formatSolver.normalizeFinalTeam([...baseTeam, ...candidate.quartet], format);
      const normalizedQuartet = fullTeam.slice(baseTeam.length);

      const context = new AnalysisContext({
        format,
        selectedPokemon: fullTeam,
        candidatePool: candidates,
        teamIdentity,
      });

      await this.pipeline.run(context);

      this.insertIfRelevant(best, {
        team: normalizedQuartet,
        context,
      });
    }

    return best.sort(this.compareCombinations);
  }

  private buildOptimizedQuartetSearchSpace(
    params: FindBestTriosParams,
  ): { quartets: OptimizedQuartetCandidate[]; stats: OptimizerStats } {
    const { baseTeam, candidates, format } = params;
    const formatSolver = params.formatSolver ?? this.solverRegistry.getSolver(format);
    const len = Math.min(candidates.length, 15);
    const totalPossible = this.combinationCount(len, 4);
    const allValid: OptimizedQuartetCandidate[] = [];
    let skippedInvalid = 0;

    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        for (let k = j + 1; k < len; k++) {
          for (let l = k + 1; l < len; l++) {
            const quartet = [candidates[i], candidates[j], candidates[k], candidates[l]];
            const quartetSpecies = new Set(quartet.map(pokemon => getSpeciesClauseKey(pokemon.name)));
            if (quartetSpecies.size !== quartet.length) {
              skippedInvalid++;
              continue;
            }

            const fullTeam = formatSolver.normalizeFinalTeam([...baseTeam, ...quartet], format);

            const validation = formatSolver.validateFinalTeam(fullTeam, format);
            if (!validation.valid) {
              if (skippedInvalid < 5) {
                console.log(`[DEBUG] Combinação inválida: ${fullTeam.map(p => p.name).join(', ')} | Falhas:`, validation.hardFailures);
              }
              skippedInvalid++;
              continue;
            }

            if (!this.isValidTeam(fullTeam, baseTeam, format, formatSolver)) {
              if (skippedInvalid < 5) {
                console.log(`[DEBUG] Combinação rejeitada por isValidTeam: ${fullTeam.map(p => p.name).join(', ')}`);
              }
              skippedInvalid++;
              continue;
            }

            allValid.push({
              quartet,
              signature: this.getSignature(quartet),
              heuristicScore: this.calculateHeuristicScore(quartet, params, formatSolver),
            });
          }
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
        quartets: allValid,
        stats: {
          totalPossible,
          validGenerated: allValid.length,
          selectedForPipeline: allValid.length,
          skippedInvalid,
        },
      };
    }

    const selected = new Map<string, OptimizedQuartetCandidate>();
    const exploitationBudget = Math.max(
      Math.floor(searchBudget * this.options.exploitationRatio),
      1,
    );

    for (let i = 0; i < exploitationBudget; i++) {
      const candidate = allValid[i];
      if (candidate) {
        selected.set(candidate.signature, candidate);
      }
    }

    const explorationBudget = searchBudget - selected.size;
    let attempts = 0;
    while (selected.size < searchBudget && attempts < 1000 && allValid.length > 0) {
      attempts++;
      const index = Math.floor(Math.random() * allValid.length);
      const candidate = allValid[index];
      if (candidate && !selected.has(candidate.signature)) {
        selected.set(candidate.signature, candidate);
      }
    }

    return {
      quartets: Array.from(selected.values()),
      stats: {
        totalPossible,
        validGenerated: allValid.length,
        selectedForPipeline: selected.size,
        skippedInvalid,
      },
    };
  }
}
