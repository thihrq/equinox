import { Pokemon } from '../models/Pokemon';
import { FormatContext } from '../strategies/FormatStrategy';

export class PokemonService {
  public static async getPokemonByName(name: string, formatId: string) {
    const pokemonData = await Pokemon.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (!pokemonData) return null;
    const formatContext = new FormatContext(formatId);
    return formatContext.execute(pokemonData);
  }
}
