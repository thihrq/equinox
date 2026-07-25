import fs from 'fs';
import path from 'path';
import { normalizeChampionsId } from '../../data-normalization/champions/ChampionsAliasNormalizer';
import { ChampionsRosterEntry } from '../../data-packs/champions/ChampionsPackageTypes';

export function importRosterSnapshot(inputPath: string): ChampionsRosterEntry[] {
  const absolutePath = path.resolve(inputPath);
  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as { pokemon?: Array<Record<string, unknown>> };

  if (!Array.isArray(payload.pokemon)) throw new Error('roster snapshot must contain a pokemon array');

  return payload.pokemon.map((entry, index) => {
    const pokemonId = normalizeChampionsId(String(entry.pokemonId ?? entry.name ?? ''));
    if (!pokemonId) throw new Error(`roster entry ${index} has no pokemonId`);

    return {
      pokemonId,
      speciesId: normalizeChampionsId(String(entry.speciesId ?? entry.pokemonId ?? entry.name ?? '')),
      displayName: String(entry.displayName ?? entry.name ?? pokemonId),
      formId: entry.formId ? normalizeChampionsId(String(entry.formId)) : undefined,
      legal: entry.legal === true,
      regulationId: 'M-B',
      verificationStatus: 'provisional' as const,
      sourceEvidence: [],
    };
  });
}
