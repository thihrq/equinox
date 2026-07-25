import mongoose from 'mongoose';
import { Pokemon } from '../models/Pokemon';
import { FormatContext } from '../strategies/FormatStrategy';
import { isSyntheticFallbackAllowed, resolveSyntheticFallbackContext } from '../config/syntheticFallbackPolicy';

export class PokemonService {
  public static async getPokemonByName(name: string, formatId: string) {
    const mongoConnected = mongoose.connection.readyState === 1;
    let pokemonData: any = null;

    if (mongoConnected) {
      pokemonData = await Pokemon.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } }).lean();
    }

    // O fallback sintetico so se aplica quando o Mongo esta indisponivel -- se conectado e
    // simplesmente nao encontrou o Pokemon, o comportamento original (retornar null) e mantido.
    if (!pokemonData && !mongoConnected) {
      if (!isSyntheticFallbackAllowed(resolveSyntheticFallbackContext())) return null;

      pokemonData = {
        name,
        species: name,
        types: ['Normal'],
        baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
        abilities: ['Pressure'],
        moves: ['Tackle', 'Protect'],
        variants: [],
        sourceMode: 'synthetic-local-dev',
        productionEligible: false,
        validatedPackageBacked: false,
      };
    }

    if (!pokemonData) return null;

    const formatContext = new FormatContext(formatId);
    return formatContext.execute(pokemonData);
  }
}
