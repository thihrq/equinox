import { PokemonService } from './PokemonService';
import { Pokemon } from '../models/Pokemon';
import { PokemonSet } from '../models/PokemonSet';
import { generateBasicKit, getMegaBaseName, getMegaStone, getSpeciesClauseKey } from '../equinox/utils/PokemonUtils';
import { CompetitiveKitGenerator } from '../equinox/utils/CompetitiveKitGenerator';

import { AnalysisPipeline } from '../equinox/core/AnalysisPipeline';
import { AnalysisContext, PokemonData } from '../equinox/core/AnalysisContext';

import { DefensiveMatrixEngine } from '../equinox/engines/DefensiveMatrixEngine';
import { WeaknessScoreEngine } from '../equinox/engines/WeaknessScoreEngine';
import { RoleEngine } from '../equinox/engines/RoleEngine';
import { SpeedEngine } from '../equinox/engines/SpeedEngine';
import { OffensiveCoverageEngine } from '../equinox/engines/OffensiveCoverageEngine';
import { ThreatEngine } from '../equinox/engines/ThreatEngine';
import { FormatIntelligenceEngine } from '../equinox/engines/FormatIntelligenceEngine';
import { RadicalRedBossGauntletEngine } from '../equinox/engines/RadicalRedBossGauntletEngine';
import { ChampionsRegulationEngine } from '../equinox/engines/ChampionsRegulationEngine';
import { DataSourceEngine } from '../equinox/engines/DataSourceEngine';
import { DamageEngine } from '../equinox/engines/DamageEngine';
import { AIBuilderEngine } from '../equinox/engines/AIBuilderEngine';
import { MetaEngine } from '../equinox/meta/MetaEngine';
import { CoachEngine } from '../equinox/coach/CoachEngine';
import { FinalScoreEngine } from '../equinox/engines/FinalScoreEngine';
import { SynergyEngine } from '../equinox/engines/SynergyEngine';
import { VgcTeamPlanEngine } from '../equinox/engines/VgcTeamPlanEngine';

import { CandidateSelector } from '../equinox/recommendation/CandidateSelector';
import {
  CandidateScoreEngine,
  TeamIdentity,
} from '../equinox/recommendation/CandidateScoreEngine';
import { DiversityCandidateSelector } from '../equinox/recommendation/DiversityCandidateSelector';
import { CombinationSearchEngine, EvaluatedCombination } from '../equinox/recommendation/CombinationSearchEngine';
import {
  CandidateDiversitySummary,
  RecommendationAdapter,
} from '../equinox/recommendation/RecommendationAdapter';

import { getDamageMultiplier } from '../equinox/utils/DamageMultiplier';
import { RecommendationCache } from '../equinox/cache/RecommendationCache';
import { VanillaGameProfileRegistry } from '../equinox/formats/VanillaGameProfiles';
import { FormatPerformanceProfileRegistry } from '../equinox/performance/FormatPerformanceProfile';
import { RadicalRedGauntletScorer } from '../equinox/radicalred/RadicalRedGauntletScorer';
import { appConfig } from '../config/env';
import { FormatLegalityRules } from '../equinox/recommendation/FormatLegalityRules';
import { FormatSolverRegistry } from '../equinox/format-solvers/FormatSolverRegistry';
import { resolveFormatPlan } from '../equinox/format-solvers/FormatPlanResolver';


export type TeamSuggestionInputErrorCode =
  | 'INVALID_TEAM_SIZE'
  | 'POKEMON_NOT_FOUND'
  | 'VANILLA_POOL_INCOMPATIBLE'
  | 'FORMAT_RULE_INCOMPATIBLE';

export class TeamSuggestionInputError extends Error {
  public readonly statusCode = 400;

  constructor(
    public readonly code: TeamSuggestionInputErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'TeamSuggestionInputError';
  }
}

export class TeamService {
  private static readonly vanillaGameProfiles = new VanillaGameProfileRegistry();
  private static readonly formatLegalityRules = new FormatLegalityRules();
  private static readonly formatSolverRegistry = new FormatSolverRegistry();

  private static getCandidateLimitForProfile(profileId: string): number {
    if (appConfig.runtimeProfile !== 'render_free') return 300;

    const limits: Record<string, number> = {
      'radical-red-gauntlet-performance': 36,
      'champions-doubles-performance': 42,
      'champions-singles-performance': 42,
      'vanilla-game-performance': 54,
      'meta-ladder-performance': 60,
      'default-performance': 48,
    };

    return limits[profileId] ?? limits['default-performance'];
  }


  public static createFullAnalysisPipeline(): AnalysisPipeline {
    return new AnalysisPipeline()
      .use(new DefensiveMatrixEngine())
      .use(new WeaknessScoreEngine())
      .use(new RoleEngine())
      .use(new SpeedEngine())
      .use(new OffensiveCoverageEngine())
      .use(new FormatIntelligenceEngine())
      .use(new RadicalRedBossGauntletEngine())
      .use(new ChampionsRegulationEngine())
      .use(new MetaEngine())
      .use(new DataSourceEngine())
      .use(new ThreatEngine())
      .use(new DamageEngine())
      .use(new SynergyEngine())
      .use(new CoachEngine())
      .use(new AIBuilderEngine())
      .use(new VgcTeamPlanEngine())
      .use(new FinalScoreEngine());
  }

  private static createFastVgcRankingPipeline(): AnalysisPipeline {
    return new AnalysisPipeline()
      .use(new VgcTeamPlanEngine());
  }

  private static createChampionsSinglesRankingPipeline(): AnalysisPipeline {
    return new AnalysisPipeline()
      .use(new DefensiveMatrixEngine())
      .use(new WeaknessScoreEngine())
      .use(new RoleEngine())
      .use(new SpeedEngine())
      .use(new OffensiveCoverageEngine())
      .use(new ChampionsRegulationEngine())
      .use(new FinalScoreEngine());
  }

  private static createVanillaRankingPipeline(): AnalysisPipeline {
    return new AnalysisPipeline()
      .use(new DefensiveMatrixEngine())
      .use(new WeaknessScoreEngine())
      .use(new RoleEngine())
      .use(new SpeedEngine())
      .use(new OffensiveCoverageEngine())
      .use(new FinalScoreEngine());
  }

  private static createRadicalRedRankingPipeline(): AnalysisPipeline {
    return new AnalysisPipeline()
      .use(new DefensiveMatrixEngine())
      .use(new WeaknessScoreEngine())
      .use(new OffensiveCoverageEngine())
      .use(new RadicalRedBossGauntletEngine())
      .use(new FinalScoreEngine());
  }

  private static dedupeFinalCandidates(candidates: PokemonData[]): PokemonData[] {
    const selected = new Map<string, PokemonData>();

    for (const candidate of candidates) {
      const key = getSpeciesClauseKey(candidate.name);
      if (!selected.has(key)) {
        selected.set(key, candidate);
      }
    }

    return [...selected.values()];
  }

  private static async hydrateFinalCombinations(params: {
    combinations: EvaluatedCombination[];
    baseTeam: PokemonData[];
    candidates: PokemonData[];
    format: string;
    teamIdentity: TeamIdentity;
    pipeline: AnalysisPipeline;
    limit: number;
  }): Promise<EvaluatedCombination[]> {
    const { combinations, baseTeam, candidates, format, teamIdentity, pipeline, limit } = params;
    const selected = combinations.slice(0, Math.max(1, limit));
    const hydrated: EvaluatedCombination[] = [];

    console.time('RecommendationHydration');

    for (const combination of selected) {
      const fullTeam = [...baseTeam, ...combination.team];
      const context = new AnalysisContext({
        format,
        selectedPokemon: fullTeam,
        candidatePool: candidates,
        teamIdentity,
        lockedLead: baseTeam.length === 2 ? [baseTeam[0].name, baseTeam[1].name] : undefined,
      });

      await pipeline.run(context);
      hydrated.push({ team: combination.team, context });
    }

    console.timeEnd('RecommendationHydration');

    return hydrated.length ? hydrated : combinations;
  }

  public static getDamageMultiplier(
    defTypes: string[],
    atkType: string,
  ): number {
    return getDamageMultiplier(defTypes, atkType);
  }

  public static async suggestComplements(
    currentMembers: string[],
    format: string,
    allowLegendaries: boolean = false,
    teamIdentity: TeamIdentity = 'balanced',
  ) {
    console.time('EquinoxTotal');

    const isVgcFormat = format.toLowerCase().startsWith('champions');
    const isValidLength = currentMembers.length === 3 || (isVgcFormat && currentMembers.length === 2);

    if (!Array.isArray(currentMembers) || !isValidLength) {
      console.timeEnd('EquinoxTotal');
      throw new TeamSuggestionInputError(
        'INVALID_TEAM_SIZE',
        isVgcFormat
          ? 'Informe exatamente 2 Pokémon (para construir ao redor da lead) ou 3 Pokémon (para completar o núcleo).'
          : 'Informe exatamente 3 Pokémon válidos para montar a base do time.',
      );
    }

    const cacheKey = RecommendationCache.buildKey({
      currentMembers,
      format,
      allowLegendaries,
      teamIdentity,
    });

    console.time('SmartCache');
    const cachedResponse = RecommendationCache.get(cacheKey);
    console.timeEnd('SmartCache');

    if (cachedResponse) {
      const stats = RecommendationCache.stats();
      console.log(
        `[Equinox] SmartCache HIT key=${cacheKey} size=${stats.size} hits=${stats.hits} misses=${stats.misses}`,
      );
      console.timeEnd('EquinoxTotal');
      return cachedResponse;
    }

    const cacheStats = RecommendationCache.stats();
    console.log(
      `[Equinox] SmartCache MISS key=${cacheKey} size=${cacheStats.size} hits=${cacheStats.hits} misses=${cacheStats.misses}`,
    );

    const formatSolver = this.formatSolverRegistry.getSolver(format);
    console.log(`[Equinox] FormatSolver=${formatSolver.label} mode=${formatSolver.mode}`);

    console.time('CurrentTeam');
    const currentTeam = await Promise.all(
      currentMembers.map(name => PokemonService.getPokemonByName(name, format)),
    );
    console.timeEnd('CurrentTeam');

    const missingBasePokemon = currentMembers.filter((_, index) => currentTeam[index] === null);

    if (missingBasePokemon.length > 0) {
      throw new TeamSuggestionInputError(
        'POKEMON_NOT_FOUND',
        `Pokémon não encontrado: ${missingBasePokemon.join(', ')}. Verifique a escrita e tente novamente.`,
        {
          pokemonNames: missingBasePokemon,
        },
      );
    }

    const rawCurrentTeam = currentTeam as PokemonData[];
    const validCurrentTeam: PokemonData[] = [];
    for (const pokemon of rawCurrentTeam) {
      // Normaliza nome Mega para busca de sets (ex: "Charizard-Mega-Y" → "Charizard")
      const baseName = getMegaBaseName(pokemon.name);
      let set = await PokemonSet.findOne({ pokemonName: pokemon.name, formatId: format }).lean();
      if (!set && baseName !== pokemon.name) {
        set = await PokemonSet.findOne({ pokemonName: baseName, formatId: format }).lean();
      }
      if (!set) {
        set = await PokemonSet.findOne({ pokemonName: pokemon.name }).lean();
      }
      if (!set && baseName !== pokemon.name) {
        set = await PokemonSet.findOne({ pokemonName: baseName }).lean();
      }
      const defaultKit = set || !formatSolver.usesDoublesMechanicContracts ? null : CompetitiveKitGenerator.generate(pokemon, format);
      const basicKit = generateBasicKit(pokemon, format);

      // Mega Pokémon DEVE segurar a Mega Stone correta
      const megaStone = getMegaStone(pokemon.name);
      const resolvedSet = formatSolver.normalizePokemonSet({
        pokemon: {
          ...pokemon,
          ability: pokemon.ability || set?.ability || defaultKit?.ability,
          item: megaStone || pokemon.item || set?.item || defaultKit?.item,
          moves: pokemon.moves && pokemon.moves.length > 0 ? pokemon.moves : (set?.moves || defaultKit?.moves),
          nature: pokemon.nature || set?.nature || basicKit.nature,
          role: pokemon.role || set?.role || basicKit.role,
        },
        format,
        savedSet: set,
        defaultKit,
        basicKit,
        preferCurated: true,
      });

      validCurrentTeam.push(resolvedSet);
    }

    validCurrentTeam.splice(0, validCurrentTeam.length, ...formatSolver.normalizeFinalTeam(validCurrentTeam, format));

    let lockedFormatPlan = resolveFormatPlan(validCurrentTeam, format, formatSolver.mode);

    // Second pass: once the core plan is known, normalize user-selected sets with
    // plan context. This is what lets a name-only support pick such as a low-speed
    // Prankster utility Pokémon become manual weather support for a detected Rain,
    // Sun, Sand or Snow plan without leaking that behavior to non-Doubles formats.
    if (formatSolver.usesDoublesMechanicContracts && lockedFormatPlan.primaryWeather) {
      const planAwareCurrentTeam = validCurrentTeam.map(pokemon => formatSolver.normalizePokemonSet({
        pokemon,
        format,
        preferCurated: true,
        formatPlan: lockedFormatPlan,
      }));

      validCurrentTeam.splice(0, validCurrentTeam.length, ...formatSolver.normalizeFinalTeam(planAwareCurrentTeam, format));
      lockedFormatPlan = resolveFormatPlan(validCurrentTeam, format, formatSolver.mode);
    }

    console.log(
      `[Equinox] LockedFormatPlan mode=${lockedFormatPlan.mode} weather=${lockedFormatPlan.primaryWeather ?? 'none'} speed=${lockedFormatPlan.speedPlan} confidence=${lockedFormatPlan.weatherConfidence} signals=${lockedFormatPlan.signals.join(' | ')}`
    );

    const incompatibleBasePokemon = validCurrentTeam.filter(
      pokemon => !this.formatLegalityRules.isEligible({ pokemon, format }),
    );

    if (incompatibleBasePokemon.length > 0) {
      const incompatibleNames = incompatibleBasePokemon.map(pokemon => pokemon.name);

      throw new TeamSuggestionInputError(
        'FORMAT_RULE_INCOMPATIBLE',
        `Pokémon não compatível com as regras do formato selecionado: ${incompatibleNames.join(', ')}.`,
        {
          pokemonNames: incompatibleNames,
          format,
        },
      );
    }

    const vanillaGameProfile = this.vanillaGameProfiles.getProfile(format);
    if (vanillaGameProfile?.strictPool) {
      const unavailableBasePokemon = validCurrentTeam.filter(
        pokemon => !this.vanillaGameProfiles.isPokemonAllowed(format, pokemon),
      );

      if (unavailableBasePokemon.length > 0) {
        const unavailableNames = unavailableBasePokemon.map(pokemon => pokemon.name);

        throw new TeamSuggestionInputError(
          'VANILLA_POOL_INCOMPATIBLE',
          `Pokémon não compatível com a versão selecionada: ${unavailableNames.join(', ')}. Digite Pokémon compatíveis com ${vanillaGameProfile.label}.`,
          {
            pokemonNames: unavailableNames,
            formatLabel: vanillaGameProfile.label,
            poolLabel: vanillaGameProfile.poolLabel,
          },
        );
      }
    }

    console.time('MongoCandidates');
    const allCandidates = (await Pokemon.find({}).lean()) as unknown as PokemonData[];
    console.timeEnd('MongoCandidates');

    const performanceProfile = new FormatPerformanceProfileRegistry().getProfile(format);

    console.time('CandidateSelector');
    const candidateLimit = this.getCandidateLimitForProfile(performanceProfile.id);
    const validCandidates = new CandidateSelector().select({
      allPokemon: allCandidates,
      currentMembers,
      format,
      allowLegendaries,
      limit: candidateLimit,
      baseTeam: validCurrentTeam,
      formatSolverMode: formatSolver.mode,
    });
    console.timeEnd('CandidateSelector');

    if (validCandidates.length < 3) {
      console.timeEnd('EquinoxTotal');

      return {
        topTeams: [],
        candidateDiversity: {
          rawCandidates: allCandidates.length,
          validCandidates: validCandidates.length,
          scoredCandidates: 0,
          diversifiedCandidates: 0,
          topCandidates: [],
        },
        debug: {
          reason: 'Menos de 3 candidatos válidos após CandidateSelector.',
          validCandidates: validCandidates.length,
        },
      };
    }

    console.time('CandidateScore');
    const scoredCandidates = new CandidateScoreEngine().scoreCandidates({
      baseTeam: validCurrentTeam,
      candidates: validCandidates,
      format,
      teamIdentity,
      formatSolver,
    });
    console.timeEnd('CandidateScore');

    console.time('DiversitySelector');
    const isChampionsDoublesProfile = formatSolver.mode === 'champions_doubles' || formatSolver.usesBossGauntlet;
    const diversifiedResults = new DiversityCandidateSelector().select(
      scoredCandidates,
      formatSolver.getDiversityOptions(),
    );

    const diversifiedCandidates = diversifiedResults.map(result => result.pokemon);
    console.timeEnd('DiversitySelector');

    const candidateDiversity: CandidateDiversitySummary = {
      rawCandidates: allCandidates.length,
      validCandidates: validCandidates.length,
      scoredCandidates: scoredCandidates.length,
      diversifiedCandidates: diversifiedCandidates.length,
      topCandidates: diversifiedResults.slice(0, 12).map(result => ({
        name: result.pokemon.name,
        score: result.score,
        roles: result.roles,
        types: result.types,
        reasons: result.reasons.slice(0, 4),
      })),
    };

    console.log(
      `[Equinox] Identity=${teamIdentity} | Candidates: raw=${allCandidates.length}, valid=${validCandidates.length}, scored=${scoredCandidates.length}, diversified=${diversifiedCandidates.length}`,
    );

    console.log(
      `[Equinox] Top candidates: ${diversifiedResults
        .slice(0, 10)
        .map(result => `${result.pokemon.name}(${result.score})`)
        .join(', ')}`,
    );

    if (diversifiedCandidates.length < 3) {
      console.timeEnd('EquinoxTotal');

      return {
        topTeams: [],
        candidateDiversity,
        debug: {
          reason: 'Menos de 3 candidatos após DiversityCandidateSelector.',
          validCandidates: validCandidates.length,
          scoredCandidates: scoredCandidates.length,
          diversifiedCandidates: diversifiedCandidates.length,
        },
      };
    }

    const fullPipeline = this.createFullAnalysisPipeline();
    const rankingPipeline = formatSolver.mode === 'champions_doubles'
      ? this.createFastVgcRankingPipeline()
      : formatSolver.mode === 'champions_singles'
        ? this.createChampionsSinglesRankingPipeline()
        : formatSolver.mode === 'radical_red'
          ? this.createRadicalRedRankingPipeline()
          : this.createVanillaRankingPipeline();

    const candidateProfiles = Object.fromEntries(
      diversifiedResults.map(result => [
        result.pokemon.name,
        {
          score: result.score,
          roles: result.roles,
          types: result.types,
        },
      ]),
    );

    const candidateNames = diversifiedCandidates.map(c => c.name);
    const candidateSetNames = [...new Set([
      ...candidateNames,
      ...candidateNames.map(name => getMegaBaseName(name)),
    ])];
    const candidateSets = await PokemonSet.find({
      pokemonName: { $in: candidateSetNames },
    }).lean();

    const finalCandidates: PokemonData[] = [];
    for (const candidate of diversifiedCandidates) {
      // Normaliza nome Mega para busca de sets (ex: "Salamence-Mega" → "Salamence")
      const baseCandidateName = getMegaBaseName(candidate.name);
      let sets = candidateSets.filter(s => s.pokemonName === candidate.name && s.formatId === format);
      if (sets.length === 0 && baseCandidateName !== candidate.name) {
        sets = candidateSets.filter(s => s.pokemonName === baseCandidateName && s.formatId === format);
      }
      if (sets.length === 0) {
        sets = candidateSets.filter(s => s.pokemonName === candidate.name);
      }
      if (sets.length === 0 && baseCandidateName !== candidate.name) {
        sets = candidateSets.filter(s => s.pokemonName === baseCandidateName);
      }

      // Mega Pokémon DEVE segurar a Mega Stone correta
      const megaStone = getMegaStone(candidate.name);

      if (sets.length > 0) {
        for (const set of sets) {
          finalCandidates.push(formatSolver.normalizePokemonSet({
            pokemon: {
              ...candidate,
              ability: set.ability,
              item: megaStone ?? set.item,
              moves: set.moves,
              nature: set.nature,
              role: set.role,
            },
            format,
            savedSet: set,
            preferCurated: true,
            formatPlan: lockedFormatPlan,
          }));
        }
      } else {
        const defaultKit = formatSolver.usesDoublesMechanicContracts ? CompetitiveKitGenerator.generate(candidate, format) : null;
        const basicKit = generateBasicKit(candidate, format);
        finalCandidates.push(formatSolver.normalizePokemonSet({
          pokemon: {
            ...candidate,
            ability: defaultKit?.ability,
            item: megaStone ?? defaultKit?.item,
            moves: defaultKit?.moves,
            nature: basicKit.nature,
            role: basicKit.role,
          },
          format,
          defaultKit,
          basicKit,
          preferCurated: true,
          formatPlan: lockedFormatPlan,
        }));
      }
    }

    const dedupedFinalCandidates = this.dedupeFinalCandidates(finalCandidates);

    console.log(
      `[Equinox] FinalCandidateSets: before=${finalCandidates.length}, after=${dedupedFinalCandidates.length}`,
    );

    console.log(
      `[Equinox] PerformanceGuardrail=${performanceProfile.label} | maxPipeline=${performanceProfile.maxPipelineEvaluations}, keep=${performanceProfile.maxCombinationsToKeep}, note=${performanceProfile.note}`,
    );

    console.time('CombinationSearch');
    const combinations = await new CombinationSearchEngine(
      rankingPipeline,
      performanceProfile.maxCombinationsToKeep,
      {
        maxPipelineEvaluations: teamIdentity === 'creative' ? 24 : performanceProfile.maxPipelineEvaluations,
        exploitationRatio: teamIdentity === 'creative' ? 0.60 : performanceProfile.exploitationRatio,
        anchorCandidateLimit: performanceProfile.anchorCandidateLimit,
        perAnchorCombinations: performanceProfile.perAnchorCombinations,
        maxPreFilterTimeMs: performanceProfile.maxPreFilterTimeMs,
        maxPipelineTimeMs: performanceProfile.maxPipelineTimeMs,
      },
    ).findBestComplements({
      baseTeam: validCurrentTeam,
      candidates: dedupedFinalCandidates,
      format,
      teamIdentity,
      candidateProfiles,
      formatSolver,
    });
    console.timeEnd('CombinationSearch');

    const hydratedCombinations = isChampionsDoublesProfile
      ? await this.hydrateFinalCombinations({
          combinations,
          baseTeam: validCurrentTeam,
          candidates: dedupedFinalCandidates,
          format,
          teamIdentity,
          pipeline: fullPipeline,
          limit: 5,
        })
      : combinations;

    if (new RadicalRedGauntletScorer().isApplicable(format)) {
      const rrCacheStats = RadicalRedGauntletScorer.getCacheStats();
      console.log(
        `[Equinox] RadicalRedScoreCache: teamScores=${rrCacheStats.teamScores}, answerScores=${rrCacheStats.answerScores}`,
      );
    }

    console.log(`[Equinox] Combinations kept=${hydratedCombinations.length}`);

    console.time('RecommendationAdapter');
    const response = new RecommendationAdapter().toLegacyResponse(
      hydratedCombinations,
      format,
      candidateDiversity,
    );
    console.timeEnd('RecommendationAdapter');

    console.log(`[Equinox] TopTeams returned=${response.topTeams.length}`);

    RecommendationCache.set(cacheKey, response);
    const updatedCacheStats = RecommendationCache.stats();
    console.log(
      `[Equinox] SmartCache STORE key=${cacheKey} size=${updatedCacheStats.size} ttlMs=${updatedCacheStats.ttlMs}`,
    );

    console.timeEnd('EquinoxTotal');

    return response;
  }
}
