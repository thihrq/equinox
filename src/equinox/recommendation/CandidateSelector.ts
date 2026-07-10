import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { VanillaGameProfileRegistry } from '../formats/VanillaGameProfiles';
import { calculateBST, getSpeciesClauseKey, getVariant } from '../utils/PokemonUtils';
import { EquinoxFormatMode } from '../format-solvers/FormatSolver';
import { evaluateCandidateAgainstResolvedPlan, resolveFormatPlan } from '../format-solvers/FormatPlanResolver';
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

    const ranked = filtered
      .map(pokemon => ({
        pokemon,
        score: this.calculateSelectionScore(pokemon, format, plan, baseTeam),
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.pokemon)
      .slice(0, limit);

    const selected = ranked;

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
