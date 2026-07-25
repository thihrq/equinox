import { IPokemon, IPokemonVariant } from '../models/Pokemon';
import { FormatIntelligenceRegistry } from '../equinox/formats/FormatIntelligenceRegistry';
import { VanillaGameProfileRegistry } from '../equinox/formats/VanillaGameProfiles';

export interface IFormatStrategy {
  formatPokemon(pokemon: IPokemon): any;
}

function buildPokemonResponse(
  pokemon: any,
  variant: IPokemonVariant | undefined,
  formatActive: string,
  fallbackTier: string,
) {
  return {
    id: pokemon._id || pokemon.name,
    name: pokemon.name,
    dexNumber: pokemon.dexNumber || 1,
    formatActive,
    types: variant?.types || pokemon.types || ['Normal'],
    abilities: variant?.abilities || pokemon.abilities || ['Pressure'],
    baseStats: variant?.baseStats || pokemon.baseStats || { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
    tier: variant?.tier || fallbackTier,
  };
}

export class VanillaStrategy implements IFormatStrategy {
  formatPokemon(pokemon: IPokemon) {
    const variants = pokemon.variants || [];
    const variant = variants.find(v => v.formatId === 'vanilla');
    return buildPokemonResponse(pokemon, variant, 'vanilla', 'Untiered');
  }
}

export class RadicalRedStrategy implements IFormatStrategy {
  formatPokemon(pokemon: IPokemon) {
    const variants = pokemon.variants || [];
    const variant =
      variants.find(v => v.formatId === 'radical_red') ??
      variants.find(v => v.formatId === 'vanilla');

    return buildPokemonResponse(pokemon, variant, 'radical_red', 'RR-Untiered');
  }
}

export class GenericFallbackStrategy implements IFormatStrategy {
  constructor(private readonly formatId: string) {}

  formatPokemon(pokemon: IPokemon) {
    const variants = pokemon.variants || [];
    const variant =
      variants.find(v => v.formatId === this.formatId) ??
      variants.find(v => v.formatId === 'vanilla') ??
      variants[0];

    return buildPokemonResponse(pokemon, variant, this.formatId, 'Format-Untiered');
  }
}

export class FormatContext {
  private readonly strategy: IFormatStrategy;
  private readonly registry = new FormatIntelligenceRegistry();
  private readonly vanillaGameProfiles = new VanillaGameProfileRegistry();

  constructor(formatId: string) {
    // Normalizacao via registry preservada como fonte de verdade -- ver HD-1 /
    // artifacts/release-governance/core-safety-validation-<run-id>/format-equivalence/final-decision.json.
    // Uma reescrita baseada em prefixo literal foi avaliada e rejeitada: 48 divergencias reais
    // (perda de resolucao de alias para champions_reg_m_b_singles/doubles, national_dex, red/blue/
    // yellow, fire_red, radical_red com variantes de espaco/hifen, legends_za, sword/shield,
    // scarlet/violet, entre outras) e crash em formatId null/undefined.
    const canonicalFormat = this.registry.normalizeFormat(formatId);

    if (canonicalFormat === 'radical_red') {
      this.strategy = new RadicalRedStrategy();
    } else if (canonicalFormat === 'vanilla' || this.vanillaGameProfiles.isGameProfile(canonicalFormat)) {
      this.strategy = new VanillaStrategy();
    } else {
      this.strategy = new GenericFallbackStrategy(canonicalFormat);
    }
  }

  public execute(pokemon: IPokemon) {
    return this.strategy.formatPokemon(pokemon);
  }
}
