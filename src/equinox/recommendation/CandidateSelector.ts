import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { VanillaGameProfileRegistry } from '../formats/VanillaGameProfiles';
import { calculateBST, getVariant } from '../utils/PokemonUtils';
import { FormatLegalityRules } from './FormatLegalityRules';

interface CandidateSelectorParams {
  allPokemon: PokemonData[];
  currentMembers: string[];
  format: string;
  allowLegendaries: boolean;
  limit?: number;
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
    } = params;

    const currentNames = new Set(
      currentMembers.map(name => name.toLowerCase().trim()),
    );

    const filtered = allPokemon
      .filter(pokemon => {
        const normalizedName = pokemon.name.toLowerCase().trim();

        if (this.isBanned(normalizedName)) return false;
        if (this.isUnsupportedSpecies(pokemon.name)) return false;
        if (!this.legalityRules.isEligible({ pokemon, format })) return false;
        if (currentNames.has(normalizedName)) return false;
        if (!allowLegendaries && pokemon.isLegendary) return false;
        if (!this.vanillaGameProfiles.isPokemonAllowed(format, pokemon)) return false;

        const variant = getVariant(pokemon, format);
        if (!variant) return false;

        const bst = calculateBST(variant.baseStats);

        const bstRange = this.legalityRules.getBstRange(format);

        return bst >= bstRange.min && bst <= bstRange.max;
      })
      .sort((a, b) => {
        const bstA = calculateBST(getVariant(a, format)?.baseStats);
        const bstB = calculateBST(getVariant(b, format)?.baseStats);

        return bstB - bstA;
      })
      .slice(0, limit);

    const vanillaProfile = this.vanillaGameProfiles.getProfile(format);

    if (vanillaProfile?.strictPool) {
      console.log(
        `[Equinox] VanillaGamePool=${vanillaProfile.id} pool=${vanillaProfile.poolLabel} candidates=${filtered.length}`,
      );
    }

    return filtered;
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
