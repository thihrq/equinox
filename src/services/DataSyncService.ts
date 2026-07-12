import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PokemonSet } from '../models/PokemonSet';

export class DataSyncService {
  private static readonly LOCAL_PACK_PATH = path.join(__dirname, '../equinox/data-packs/sets-data-pack.json');
  private static readonly REMOTE_URL = 'https://raw.githubusercontent.com/obra/superpowers/main/sets-data-pack.json';
  private static currentVersion = '2026.07.09.01';

  private static mapToBulkOperations(sets: any[]): any[] {
    return sets.map((set: any) => ({
      updateOne: {
        filter: { pokemonName: set.pokemonName, formatId: set.formatId, setName: set.setName },
        update: { $set: set },
        upsert: true
      }
    }));
  }

  public static async bootstrap(): Promise<void> {
    const localData = JSON.parse(fs.readFileSync(this.LOCAL_PACK_PATH, 'utf8'));
    const bulkOperations = this.mapToBulkOperations(localData.sets);

    if (bulkOperations.length > 0) {
      await PokemonSet.bulkWrite(bulkOperations);
      console.log(`[Equinox DataSync] Bootstrap carregou ${bulkOperations.length} conjuntos competitivos.`);
    }
    if (localData.version) {
      this.currentVersion = localData.version;
    }
  }

  public static async syncRemote(): Promise<void> {
    try {
      let remoteData: any;
      try {
        const response = await axios.get(this.REMOTE_URL);
        remoteData = response.data;
      } catch (err: any) {
        console.warn(`[Equinox DataSync] Falha na checagem remota, usando cache local. Erro: ${err.message}`);
        return;
      }

      if (!remoteData || !Array.isArray(remoteData.sets)) {
        throw new Error('Formato do arquivo remoto inválido.');
      }

      if (remoteData.version === this.currentVersion) {
        console.log(`[Equinox DataSync] Versão do data pack remota (${remoteData.version}) é idêntica à em memória. Ignorando sincronização.`);
        return;
      }

      const bulkOperations = this.mapToBulkOperations(remoteData.sets);

      if (bulkOperations.length > 0) {
        await PokemonSet.bulkWrite(bulkOperations);
        console.log(`[Equinox DataSync] Sincronização remota atualizou ${bulkOperations.length} conjuntos.`);
      }

      this.currentVersion = remoteData.version;
    } catch (err: any) {
      console.warn(`[Equinox DataSync] Erro inesperado na sincronização remota:`, err);
    }
  }
}
