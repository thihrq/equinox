declare const require: (moduleName: string) => any;
const crypto = require('crypto') as any;
const { normalizeChampionsId } = require('../../../data-normalization/champions/ChampionsAliasNormalizer') as { normalizeChampionsId: (value: string) => string };
import { OfficialEligiblePokemonRecord, OfficialWebSnapshotSource } from './ChampionsOfficialWebSourceTypes';

export function parseOfficialEligiblePokemonPayload(payload: unknown, source: OfficialWebSnapshotSource): OfficialEligiblePokemonRecord[] {
  const rawRecords = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as any).pokemon)
      ? (payload as any).pokemon
      : payload && typeof payload === 'object' && Array.isArray((payload as any).eligiblePokemon)
        ? (payload as any).eligiblePokemon
        : null;
  if (!rawRecords || rawRecords.length === 0) throw new Error('OFFICIAL_ELIGIBLE_ROSTER_EMPTY');
  const ids = new Set<string>();
  return rawRecords.map((record: any, index: number) => {
    const displayName = String(record.displayName ?? record.name ?? '').trim();
    const pokemonId = normalizeChampionsId(String(record.pokemonId ?? record.id ?? displayName));
    if (!displayName || !pokemonId) throw new Error(`OFFICIAL_ELIGIBLE_ALIAS_UNRESOLVED:${index}`);
    if (ids.has(pokemonId)) throw new Error(`OFFICIAL_ELIGIBLE_DUPLICATE_ID:${pokemonId}`);
    ids.add(pokemonId);
    return { pokemonId, displayName, formId: record.formId ? normalizeChampionsId(String(record.formId)) : undefined, source };
  });
}

export function parseOfficialEligiblePokemonJson(raw: string, source: OfficialWebSnapshotSource): OfficialEligiblePokemonRecord[] {
  try { return parseOfficialEligiblePokemonPayload(JSON.parse(raw), source); } catch (error) {
    if (error instanceof SyntaxError) throw new Error('OFFICIAL_ELIGIBLE_STRUCTURE_CHANGED');
    throw error;
  }
}

function findStructuredRecords(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    const records = value.filter(item => item && typeof item === 'object' && Boolean((item as any).name ?? (item as any).displayName ?? (item as any).pokemonId ?? (item as any).id));
    if (records.length === value.length && records.length > 0) return records;
    for (const item of value) {
      const nested = findStructuredRecords(item);
      if (nested) return nested;
    }
  } else if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      const nested = findStructuredRecords(nestedValue);
      if (nested) return nested;
    }
  }
  return null;
}

export function parseOfficialEligiblePokemonHtml(html: string, source: OfficialWebSnapshotSource): OfficialEligiblePokemonRecord[] {
  if (!html.trim()) throw new Error('OFFICIAL_ELIGIBLE_PAGE_EMPTY');
  const pokemonArray = html.match(/(?:const|let|var)\s+pokemons\s*=\s*(\[[\s\S]*?\])\s*;/i)?.[1];
  if (pokemonArray) {
    try {
      const records = JSON.parse(pokemonArray).map((entry: unknown) => {
        if (!Array.isArray(entry) || typeof entry[2] !== 'string') throw new Error('OFFICIAL_ELIGIBLE_INVALID_ENTRY');
        return { id: entry[0], name: entry[2] };
      });
      return parseOfficialEligiblePokemonPayload(records, source);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('OFFICIAL_ELIGIBLE_STRUCTURE_CHANGED');
      throw error;
    }
  }
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1].trim()).filter(Boolean);
  for (const script of scripts) {
    try {
      const records = findStructuredRecords(JSON.parse(script));
      if (records) return parseOfficialEligiblePokemonPayload(records, source);
    } catch {
      continue;
    }
  }
  throw new Error('OFFICIAL_ELIGIBLE_STRUCTURE_CHANGED');
}
