import { PokemonService } from './PokemonService';
import { Pokemon } from '../models/Pokemon';

import { AnalysisPipeline } from '../equinox/core/AnalysisPipeline';
import { PokemonData } from '../equinox/core/AnalysisContext';

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

import { CandidateSelector } from '../equinox/recommendation/CandidateSelector';
import {
  CandidateScoreEngine,
  TeamIdentity,
} from '../equinox/recommendation/CandidateScoreEngine';
import { DiversityCandidateSelector } from '../equinox/recommendation/DiversityCandidateSelector';
import { CombinationSearchEngine } from '../equinox/recommendation/CombinationSearchEngine';
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


export type TeamSuggestionInputErrorCode =
  | 'INVALID_TEAM_SIZE'
  | 'POKEMON_NOT_FOUND'
  | 'VANILLA_POOL_INCOMPATIBLE';

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

    if (!Array.isArray(currentMembers) || currentMembers.length !== 3) {
      console.timeEnd('EquinoxTotal');
      throw new TeamSuggestionInputError(
        'INVALID_TEAM_SIZE',
        'Informe exatamente 3 Pokémon válidos para montar a base do time.',
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

    const validCurrentTeam = currentTeam as PokemonData[];

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
    });
    console.timeEnd('CandidateScore');

    console.time('DiversitySelector');
    const diversifiedResults = new DiversityCandidateSelector().select(scoredCandidates, {
      maxCandidates: 60,
      topOverall: 30,
      perRole: 8,
      perType: 3,
      minCandidates: 30,
    });

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

    const pipeline = new AnalysisPipeline()
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
      .use(new CoachEngine())
      .use(new AIBuilderEngine())
      .use(new FinalScoreEngine());

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

    console.log(
      `[Equinox] PerformanceGuardrail=${performanceProfile.label} | maxPipeline=${performanceProfile.maxPipelineEvaluations}, keep=${performanceProfile.maxCombinationsToKeep}, note=${performanceProfile.note}`,
    );

    console.time('CombinationSearch');
    const combinations = await new CombinationSearchEngine(
      pipeline,
      performanceProfile.maxCombinationsToKeep,
      {
        maxPipelineEvaluations: performanceProfile.maxPipelineEvaluations,
        exploitationRatio: performanceProfile.exploitationRatio,
        anchorCandidateLimit: performanceProfile.anchorCandidateLimit,
        perAnchorCombinations: performanceProfile.perAnchorCombinations,
      },
    ).findBestTrios({
      baseTeam: validCurrentTeam,
      candidates: diversifiedCandidates,
      format,
      teamIdentity,
      candidateProfiles,
    });
    console.timeEnd('CombinationSearch');

    if (new RadicalRedGauntletScorer().isApplicable(format)) {
      const rrCacheStats = RadicalRedGauntletScorer.getCacheStats();
      console.log(
        `[Equinox] RadicalRedScoreCache: teamScores=${rrCacheStats.teamScores}, answerScores=${rrCacheStats.answerScores}`,
      );
    }

    console.log(`[Equinox] Combinations kept=${combinations.length}`);

    console.time('RecommendationAdapter');
    const response = new RecommendationAdapter().toLegacyResponse(
      combinations,
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
