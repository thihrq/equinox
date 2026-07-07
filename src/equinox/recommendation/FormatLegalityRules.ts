import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';

export interface BstRange {
  min: number;
  max: number;
}

interface ShowdownFormatRule {
  isShowdown: boolean;
  isNationalDex: boolean;
  isLittleCup: boolean;
  tier?: string;
}

const LITTLE_CUP_MAX_BST = 450;

const SHOWDOWN_TIER_ORDER: Record<string, number> = {
  AG: 0,
  Uber: 1,
  OU: 2,
  UUBL: 2,
  UU: 3,
  RUBL: 3,
  RU: 4,
  NUBL: 4,
  NU: 5,
  PUBL: 5,
  PU: 6,
  ZUBL: 6,
  ZU: 7,
  NFE: 8,
  LC: 9,
};

const FORMAT_TIER_CEILING: Record<string, number> = {
  ubers: SHOWDOWN_TIER_ORDER.Uber,
  ou: SHOWDOWN_TIER_ORDER.OU,
  uu: SHOWDOWN_TIER_ORDER.UU,
  ru: SHOWDOWN_TIER_ORDER.RU,
  nu: SHOWDOWN_TIER_ORDER.NU,
  pu: SHOWDOWN_TIER_ORDER.PU,
  zu: SHOWDOWN_TIER_ORDER.ZU,
};

const HISUI_BLOCKED_TAGS = new Set(['Ultra Beast', 'Paradox']);
const HISUI_BLOCKED_FORMES = /galar|alola|paldea|mega|primal|zen|bloodmoon/i;

export class FormatLegalityRules {
  public getBstRange(format: string): BstRange {
    if (this.getShowdownRule(format).isLittleCup) {
      return { min: 180, max: LITTLE_CUP_MAX_BST };
    }

    return { min: 450, max: 700 };
  }

  public isEligible(params: {
    pokemon: PokemonData;
    format: string;
  }): boolean {
    const { pokemon, format } = params;
    const species = Dex.species.get(pokemon.name);
    const formatId = this.normalizeFormat(format);

    if (!species.exists) return true;
    if (species.isNonstandard === 'Future') return false;

    if (formatId === 'vanilla_legends_arceus') {
      return this.isEligibleForLegendsArceus(species);
    }

    const showdownRule = this.getShowdownRule(format);

    if (showdownRule.isShowdown) {
      return this.isEligibleForShowdown(species, showdownRule);
    }

    return true;
  }

  private isEligibleForShowdown(
    species: ReturnType<typeof Dex.species.get>,
    rule: ShowdownFormatRule,
  ): boolean {
    const name = species.name.toLowerCase();

    if (!rule.isNationalDex && species.isNonstandard === 'Past') return false;
    if (!rule.isNationalDex && /-mega(?:-|$)|-gmax|primal/i.test(name)) return false;

    if (rule.isLittleCup) {
      return Boolean(species.nfe) && !species.prevo;
    }

    if (!rule.tier || rule.tier === 'anythinggoes' || rule.tier === 'draft') {
      return species.tier !== 'Illegal';
    }

    const ceiling = FORMAT_TIER_CEILING[rule.tier];
    if (!ceiling) return species.tier !== 'Illegal';

    const speciesRank = SHOWDOWN_TIER_ORDER[species.tier] ?? Number.POSITIVE_INFINITY;

    return speciesRank >= ceiling;
  }

  private isEligibleForLegendsArceus(
    species: ReturnType<typeof Dex.species.get>,
  ): boolean {
    const tags = species.tags ?? [];

    if (tags.some(tag => HISUI_BLOCKED_TAGS.has(tag))) return false;
    if (HISUI_BLOCKED_FORMES.test(species.forme || species.name)) return false;

    return species.num > 0 && species.num <= 905;
  }

  private getShowdownRule(format: string): ShowdownFormatRule {
    const id = this.normalizeFormat(format);
    const isShowdown =
      id.startsWith('gen9') ||
      id === 'national_dex' ||
      id === 'nationaldex';
    const isNationalDex = id.includes('natdex') || id.includes('national_dex') || id === 'nationaldex';
    const isLittleCup = id.endsWith('lc') || id.includes('littlecup');

    return {
      isShowdown,
      isNationalDex,
      isLittleCup,
      tier: this.getShowdownTier(id),
    };
  }

  private getShowdownTier(formatId: string): string | undefined {
    if (formatId.includes('anythinggoes')) return 'anythinggoes';
    if (formatId.includes('draft')) return 'draft';
    if (formatId.includes('ubers')) return 'ubers';
    if (formatId.includes('ou')) return 'ou';
    if (formatId.includes('uu')) return 'uu';
    if (formatId.includes('ru')) return 'ru';
    if (formatId.includes('nu')) return 'nu';
    if (formatId.includes('pu')) return 'pu';
    if (formatId.includes('zu')) return 'zu';
    if (formatId.includes('lc')) return 'lc';

    return undefined;
  }

  private normalizeFormat(format: string): string {
    return String(format || 'vanilla')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[/-]/g, '_');
  }
}
