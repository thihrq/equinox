import { IPokemon, IPokemonVariant } from '../models/Pokemon';
import { FormatIntelligenceRegistry } from '../equinox/formats/FormatIntelligenceRegistry';
import { VanillaGameProfileRegistry } from '../equinox/formats/VanillaGameProfiles';

export interface IFormatStrategy {
  formatPokemon(pokemon: IPokemon): any;
}

function buildPokemonResponse(
  pokemon: IPokemon,
  variant: IPokemonVariant | undefined,
  formatActive: string,
  fallbackTier: string,
) {
  return {
    id: pokemon._id,
    name: pokemon.name,
    dexNumber: pokemon.dexNumber,
    formatActive,
    types: variant?.types || [],
    abilities: variant?.abilities || {},
    baseStats: variant?.baseStats || {},
    tier: variant?.tier || fallbackTier,
  };
}

export class VanillaStrategy implements IFormatStrategy {
  formatPokemon(pokemon: IPokemon) {
    const variant = pokemon.variants.find(v => v.formatId === 'vanilla');
    return buildPokemonResponse(pokemon, variant, 'vanilla', 'Untiered');
  }
}

export class RadicalRedStrategy implements IFormatStrategy {
  formatPokemon(pokemon: IPokemon) {
    const variant =
      pokemon.variants.find(v => v.formatId === 'radical_red') ??
      pokemon.variants.find(v => v.formatId === 'vanilla');

    return buildPokemonResponse(pokemon, variant, 'radical_red', 'RR-Untiered');
  }
}

export class GenericFallbackStrategy implements IFormatStrategy {
  constructor(private readonly formatId: string) {}

  formatPokemon(pokemon: IPokemon) {
    const variant =
      pokemon.variants.find(v => v.formatId === this.formatId) ??
      pokemon.variants.find(v => v.formatId === 'vanilla') ??
      pokemon.variants[0];

    return buildPokemonResponse(pokemon, variant, this.formatId, 'Format-Untiered');
  }
}

export class FormatContext {
  private readonly strategy: IFormatStrategy;
  private readonly registry = new FormatIntelligenceRegistry();
  private readonly vanillaGameProfiles = new VanillaGameProfileRegistry();

  constructor(formatId: string) {
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
