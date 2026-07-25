import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PokemonSet } from '../models/PokemonSet';
import { resolveDataMode } from '../config/dataMode';

/**
 * Resolve a URL remota do manifesto de dados mantendo o caminho de projeto base (ex: /equinox/).
 * Evita o descarte involuntario de subcaminhos ao concatenar caminhos remotos com barras iniciais.
 */
export function resolveRemoteManifestUrl(
  baseUrl: string,
  manifestPath: string,
): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = manifestPath.replace(/^\/+/, '');
  return new URL(normalizedPath, normalizedBase).toString();
}

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
    if (process.env.EQUINOX_DATA_SYNC_REMOTE !== 'true' || resolveDataMode() === 'filesystem') {
      console.log('[Equinox DataSync] Sincronizacao remota ignorada (desabilitada ou modo filesystem).');
      return;
    }

    try {
      let remoteData: any;
      try {
        const targetUrl = process.env.EQUINOX_DATA_SYNC_BASE_URL && process.env.EQUINOX_DATA_SYNC_MANIFEST_PATH
          ? resolveRemoteManifestUrl(process.env.EQUINOX_DATA_SYNC_BASE_URL, process.env.EQUINOX_DATA_SYNC_MANIFEST_PATH)
          : this.REMOTE_URL;

        const response = await axios.get(targetUrl);
        remoteData = response.data;
      } catch (err: any) {
        console.warn(`[Equinox DataSync] REMOTE_MANIFEST_NOT_FOUND - Falha na checagem remota, usando cache local. Erro: ${err.message}`);
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
