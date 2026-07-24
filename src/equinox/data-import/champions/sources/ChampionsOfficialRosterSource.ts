declare const require: (moduleName: string) => any;
const fs = require('fs') as any;
const path = require('path') as any;
import { normalizeChampionsId } from '../../../data-normalization/champions/ChampionsAliasNormalizer';

export const OFFICIAL_ROSTER_ERRORS = {
  unavailable: 'OFFICIAL_ROSTER_SOURCE_UNAVAILABLE',
  structure: 'OFFICIAL_ROSTER_STRUCTURE_CHANGED',
  empty: 'OFFICIAL_ROSTER_EMPTY',
  duplicate: 'OFFICIAL_ROSTER_DUPLICATE_ID',
  alias: 'OFFICIAL_ROSTER_ALIAS_UNRESOLVED',
} as const;

export interface OfficialRosterRecord {
  pokemonId: string;
  displayName: string;
  regulationId: 'M-B';
  legal: true;
}

export function importChampionsOfficialRoster(inputPath: string): OfficialRosterRecord[] {
  const absolutePath = path.resolve(inputPath);
  if (!fs.existsSync(absolutePath)) throw new Error(OFFICIAL_ROSTER_ERRORS.unavailable);

  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as Record<string, unknown>;
  const records = Array.isArray(payload.pokemon)
    ? payload.pokemon
    : Array.isArray(payload.roster)
      ? payload.roster
      : null;
  if (!records) throw new Error(OFFICIAL_ROSTER_ERRORS.structure);
  if (records.length === 0) throw new Error(OFFICIAL_ROSTER_ERRORS.empty);

  const normalized = records.map((record, index) => {
    if (!record || typeof record !== 'object') throw new Error(`${OFFICIAL_ROSTER_ERRORS.alias}:${index}`);
    const value = record as Record<string, unknown>;
    const displayName = String(value.displayName ?? value.name ?? '').trim();
    const pokemonId = normalizeChampionsId(String(value.pokemonId ?? value.id ?? displayName));
    if (!pokemonId || !displayName) throw new Error(`${OFFICIAL_ROSTER_ERRORS.alias}:${index}`);
    return { pokemonId, displayName, regulationId: 'M-B' as const, legal: true as const };
  });

  const ids = new Set<string>();
  for (const record of normalized) {
    if (ids.has(record.pokemonId)) throw new Error(`${OFFICIAL_ROSTER_ERRORS.duplicate}:${record.pokemonId}`);
    ids.add(record.pokemonId);
  }
  return normalized;
}
