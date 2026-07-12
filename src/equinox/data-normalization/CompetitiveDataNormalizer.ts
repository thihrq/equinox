import { FORM_ALIASES, POKEMON_ALIASES } from './CompetitiveAliases';

export interface NormalizedCompetitiveSetInput {
  pokemonId: string;
  formId: string;
  moveIds: string[];
  itemId: string;
  abilityId: string;
  natureId: string;
  formatId: string;
  regulationId: string;
}

export function toCompetitiveId(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizePokemonId(value: string | undefined): string {
  const raw = String(value ?? '').trim();
  const megaPrefix = raw.match(/^mega[\s_-]+(.+)$/i);
  const id = toCompetitiveId(megaPrefix ? `${megaPrefix[1]}-mega` : raw);
  return POKEMON_ALIASES[id] ?? id;
}

export function normalizeFormId(value: string | undefined, fallbackPokemon?: string): string {
  const normalized = normalizePokemonId(value || fallbackPokemon || '');
  return FORM_ALIASES[normalized] ?? normalized;
}

export function normalizeMoveId(value: string | undefined): string {
  return toCompetitiveId(value);
}

export function normalizeAbilityId(value: string | undefined): string {
  return toCompetitiveId(value);
}

export function normalizeItemId(value: string | undefined): string {
  return toCompetitiveId(value);
}

export function normalizeNatureId(value: string | undefined): string {
  return toCompetitiveId(value);
}

export function normalizeRoleId(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function normalizeFormatId(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/[']/g, '').replace(/[\s-]+/g, '_').replace(/__+/g, '_');
}

export function normalizeRegulationId(value: string | undefined): string {
  return normalizeFormatId(value);
}

export function normalizeCompetitiveSetIdentity(input: {
  pokemonName?: string;
  pokemonId?: string;
  formId?: string;
  moves?: string[];
  item?: string;
  ability?: string;
  nature?: string;
  formatId?: string;
  regulationId?: string;
}): NormalizedCompetitiveSetInput {
  const pokemonId = normalizePokemonId(input.pokemonId || input.pokemonName);
  return {
    pokemonId,
    formId: normalizeFormId(input.formId || input.pokemonName, pokemonId),
    moveIds: (input.moves ?? []).map(normalizeMoveId).filter(Boolean),
    itemId: normalizeItemId(input.item),
    abilityId: normalizeAbilityId(input.ability),
    natureId: normalizeNatureId(input.nature),
    formatId: normalizeFormatId(input.formatId),
    regulationId: normalizeRegulationId(input.regulationId || input.formatId),
  };
}
