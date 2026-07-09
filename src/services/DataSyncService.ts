import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PokemonSet } from '../models/PokemonSet';

export class DataSyncService {
  private static readonly LOCAL_PACK_PATH = path.join(__dirname, '../equinox/data-packs/sets-data-pack.json');
  private static readonly REMOTE_URL = 'https://raw.githubusercontent.com/obra/superpowers/main/sets-data-pack.json';

  public static async bootstrap(): Promise<void> {
    const localData = JSON.parse(fs.readFileSync(this.LOCAL_PACK_PATH, 'utf8'));
    const bulkOperations = localData.sets.map((set: any) => ({
      updateOne: {
        filter: { pokemonName: set.pokemonName, formatId: set.formatId, setName: set.setName },
        update: { $set: set },
        upsert: true
      }
    }));

    if (bulkOperations.length > 0) {
      await PokemonSet.bulkWrite(bulkOperations);
      console.log(`[Equinox DataSync] Bootstrap carregou ${bulkOperations.length} conjuntos competitivos.`);
    }
  }

  public static async syncRemote(): Promise<void> {
    try {
      const response = await axios.get(this.REMOTE_URL);
      const remoteData = response.data;

      if (!remoteData || !Array.isArray(remoteData.sets)) {
        throw new Error('Formato do arquivo remoto inválido.');
      }

      const bulkOperations = remoteData.sets.map((set: any) => ({
        updateOne: {
          filter: { pokemonName: set.pokemonName, formatId: set.formatId, setName: set.setName },
          update: { $set: set },
          upsert: true
        }
      }));

      if (bulkOperations.length > 0) {
        await PokemonSet.bulkWrite(bulkOperations);
        console.log(`[Equinox DataSync] Sincronização remota atualizou ${bulkOperations.length} conjuntos.`);
      }
    } catch (err: any) {
      console.warn(`[Equinox DataSync] Falha na checagem remota, usando cache local. Erro: ${err.message}`);
    }
  }
}
