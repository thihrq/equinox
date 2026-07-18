import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { VanillaGameProfileRegistry } from '../formats/VanillaGameProfiles';
import { calculateBST, getSpeciesClauseKey, getVariant } from '../utils/PokemonUtils';
import { EquinoxFormatMode } from '../format-solvers/FormatSolver';
import {
  evaluateCandidateAgainstResolvedPlan,
  resolveFormatPlan,
  hasWeatherSetterForPlan,
  hasWeatherSupportForPlan,
  hasPrimaryWeatherAbuserForPlan,
  isTurnControlForPlan,
  isRedirectionForPlan,
  isPivotForPlan,
  WeatherPlanFamily,
} from '../format-solvers/FormatPlanResolver';
import { FormatLegalityRules } from './FormatLegalityRules';

interface CandidateSelectorParams {
  allPokemon: PokemonData[];
  currentMembers: string[];
  format: string;
  allowLegendaries: boolean;
  limit?: number;
  baseTeam?: PokemonData[];
  formatSolverMode?: EquinoxFormatMode;
}

export class CandidateSelector {
  private readonly vanillaGameProfiles = new VanillaGameProfileRegistry();
  private readonly legalityRules = new FormatLegalityRules();

  public select(params: CandidateSelectorParams): PokemonData[] {
    const {
      allPokemon,
      currentMembers,
      format,
      allowLegendaries,
      limit = 300,
      baseTeam = [],
      formatSolverMode = 'vanilla',
    } = params;

    const currentNames = new Set(
      currentMembers.map(name => name.toLowerCase().trim()),
    );
    const currentSpeciesKeys = new Set(
      currentMembers.map(name => getSpeciesClauseKey(name)),
    );

    const filtered = allPokemon
      .filter(pokemon => {
        const normalizedName = pokemon.name.toLowerCase().trim();

        if (this.isBanned(normalizedName)) return false;
        if (this.isUnsupportedSpecies(pokemon.name)) return false;
        if (!this.legalityRules.isEligible({ pokemon, format })) return false;
        if (currentNames.has(normalizedName)) return false;
        if (currentSpeciesKeys.has(getSpeciesClauseKey(pokemon.name))) return false;
        if (!allowLegendaries && pokemon.isLegendary) return false;
        if (!this.vanillaGameProfiles.isPokemonAllowed(format, pokemon)) return false;

        const variant = getVariant(pokemon, format);
        if (!variant) return false;

        const bst = calculateBST(variant.baseStats);

        const bstRange = this.legalityRules.getBstRange(format);

        return bst >= bstRange.min && bst <= bstRange.max;
      });

    const plan = baseTeam.length > 0
      ? resolveFormatPlan(baseTeam, format, formatSolverMode)
      : null;

    const rankedWithScore = filtered
      .map(pokemon => ({
        pokemon,
        score: this.calculateSelectionScore(pokemon, format, plan, baseTeam),
      }))
      .sort((a, b) => b.score - a.score);

    const top = rankedWithScore.slice(0, limit);

    if (plan?.primaryWeather) {
      this.reserveWeatherPlanSupport(top, rankedWithScore, plan.primaryWeather, format);
    }

    const selected = top.map(item => item.pokemon);

    const vanillaProfile = this.vanillaGameProfiles.getProfile(format);

    if (vanillaProfile?.strictPool) {
      console.log(
        `[Equinox] VanillaGamePool=${vanillaProfile.id} pool=${vanillaProfile.poolLabel} candidates=${selected.length}`,
      );
    }

    return selected;
  }

  private calculateSelectionScore(
    pokemon: PokemonData,
    format: string,
    plan: ReturnType<typeof resolveFormatPlan> | null,
    baseTeam: PokemonData[],
  ): number {
    const bst = calculateBST(getVariant(pokemon, format)?.baseStats);
    if (!plan) return bst;

    const objective = evaluateCandidateAgainstResolvedPlan({
      plan,
      baseTeam,
      candidate: pokemon,
      format,
    });

    return bst + objective.score - objective.hardFailures.length * 1000 - objective.warnings.length * 55;
  }

  // Achado real 2026-07-18: evaluateCandidateAgainstResolvedPlan dá +260
  // pra abuser primário da família de clima travada contra +105 pra
  // setter/suporte -- um delta muito maior que a variação de BST entre
  // espécies. O guard que deveria coibir excesso de abusers só dispara
  // quando o time base já tem 2 (evaluateCandidateAgainstResolvedPlan:301),
  // então times com só 1 abuser ambíguo no core (ex.: Charizard via
  // habilidade oculta Solar Power) deixam TODO candidato elegível como
  // abuser subir com +260 sem penalidade nesta etapa -- o corte por score
  // (.slice(0, limit)) fica 100% ocupado por abusers, e nenhum
  // setter/suporte sobra pro DiversityCandidateSelector filtrar depois.
  // Resultado real: pool de 42 candidatos = puro abuser de sol, toda
  // combinação de 3 estoura o teto de "no máximo 2 abusers" e a busca
  // combinatória não acha nenhuma válida (possible=9139, valid=0).
  // Em vez de mexer nos pesos de pontuação (usados por 4 famílias de
  // clima e outros modos, alto raio de impacto), reserva-se aqui um piso
  // mínimo de candidatos setter/suporte no corte, trocando pelos abusers
  // de menor score -- mantém o tamanho do pool fixo (sem custo extra de
  // performance no Render Free).
  private static readonly MIN_WEATHER_PLAN_SUPPORT_RESERVE = 4;

  private reserveWeatherPlanSupport(
    top: { pokemon: PokemonData; score: number }[],
    ranked: { pokemon: PokemonData; score: number }[],
    family: WeatherPlanFamily,
    format: string,
  ): void {
    const qualifiesAsSupport = (item: { pokemon: PokemonData; score: number }): boolean =>
      hasWeatherSetterForPlan(item.pokemon, format, family) ||
      hasWeatherSupportForPlan(item.pokemon, format, family) ||
      isTurnControlForPlan(item.pokemon) ||
      isRedirectionForPlan(item.pokemon) ||
      isPivotForPlan(item.pokemon);

    const reserve = Math.min(CandidateSelector.MIN_WEATHER_PLAN_SUPPORT_RESERVE, top.length);
    let supportCount = top.filter(qualifiesAsSupport).length;
    if (supportCount >= reserve) return;

    const inTop = new Set(top.map(item => item.pokemon));
    const rescueCandidates = ranked.filter(item => !inTop.has(item.pokemon) && qualifiesAsSupport(item));

    for (const rescue of rescueCandidates) {
      if (supportCount >= reserve) break;

      let evictIndex = -1;
      let evictScore = Infinity;
      for (let i = 0; i < top.length; i++) {
        if (hasPrimaryWeatherAbuserForPlan(top[i].pokemon, format, family) && top[i].score < evictScore) {
          evictScore = top[i].score;
          evictIndex = i;
        }
      }

      if (evictIndex === -1) break;

      top.splice(evictIndex, 1, rescue);
      supportCount++;
    }
  }

  private isBanned(name: string): boolean {
    if (/eternamax|gmax|primal|-ash|-therian|black|white|origin|slaking/i.test(name)) {
      return true;
    }

    if (name.includes('mega') && !name.includes('-mega')) {
      return true;
    }

    const ubers = [
      'mewtwo',
      'lugia',
      'ho-oh',
      'kyogre',
      'groudon',
      'rayquaza',
      'deoxys',
      'dialga',
      'palkia',
      'giratina',
      'arceus',
      'reshiram',
      'zekrom',
      'kyurem',
      'xerneas',
      'yveltal',
      'zygarde',
      'cosmog',
      'cosmoem',
      'solgaleo',
      'lunala',
      'necrozma',
      'zacian',
      'zamazenta',
      'eternatus',
      'calyrex',
      'koraidon',
      'miraidon',
      'darkrai',
      'regigigas',
      'chien-pao',
      'ting-lu',
      'chi-yu',
      'wo-chien',
      'palafin',
    ];

    return ubers.some(uber => name.startsWith(uber));
  }

  private isUnsupportedSpecies(name: string): boolean {
    const species = Dex.species.get(name);

    return species.exists && species.isNonstandard === 'Future';
  }
}
