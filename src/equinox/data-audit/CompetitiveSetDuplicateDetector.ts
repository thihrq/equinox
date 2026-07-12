import { normalizeAbilityId, normalizeFormId, normalizeItemId, normalizeMoveId, normalizeNatureId, normalizePokemonId, normalizeRegulationId } from '../data-normalization/CompetitiveDataNormalizer';
import { StatSpread } from '../data-validation/CompetitiveValidationTypes';

export type CompetitiveDuplicateClassification =
  | 'exact-duplicate'
  | 'equivalent-variant'
  | 'source-conflict'
  | 'role-conflict'
  | 'freshness-conflict';

export interface CompetitiveDuplicateInput {
  setId?: string;
  pokemonId: string;
  formId: string;
  regulationId: string;
  item: string;
  ability: string;
  nature: string;
  evs?: StatSpread;
  ivs?: StatSpread;
  moves: string[];
  sourceId?: string;
  primaryRole?: string;
  sourceUpdatedAt?: string | Date;
}

export interface CompetitiveDuplicateGroup {
  signature: string;
  classification: CompetitiveDuplicateClassification;
  setIds: string[];
}

export function buildCompetitiveSetSignature(input: CompetitiveDuplicateInput): string {
  const payload = {
    pokemonId: normalizePokemonId(input.pokemonId),
    formId: normalizeFormId(input.formId, input.pokemonId),
    regulationId: normalizeRegulationId(input.regulationId),
    item: normalizeItemId(input.item),
    ability: normalizeAbilityId(input.ability),
    nature: normalizeNatureId(input.nature),
    evs: input.evs ?? {},
    ivs: input.ivs ?? {},
    moves: [...input.moves.map(normalizeMoveId)].sort(),
  };
  return stableHash(JSON.stringify(payload));
}

export function detectCompetitiveSetDuplicates(inputs: CompetitiveDuplicateInput[]): CompetitiveDuplicateGroup[] {
  const groups = new Map<string, CompetitiveDuplicateInput[]>();
  for (const input of inputs) {
    const signature = buildCompetitiveSetSignature(input);
    groups.set(signature, [...(groups.get(signature) ?? []), input]);
  }

  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([signature, values]) => ({
      signature,
      classification: classifyDuplicate(values),
      setIds: values.map((value, index) => value.setId ?? `${value.pokemonId}:${index}`),
    }));
}

function classifyDuplicate(values: CompetitiveDuplicateInput[]): CompetitiveDuplicateClassification {
  if (new Set(values.map(value => value.primaryRole ?? '')).size > 1) return 'role-conflict';
  if (new Set(values.map(value => value.sourceId ?? '')).size > 1) return 'source-conflict';
  if (new Set(values.map(value => String(value.sourceUpdatedAt ?? ''))).size > 1) return 'freshness-conflict';
  return 'exact-duplicate';
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
