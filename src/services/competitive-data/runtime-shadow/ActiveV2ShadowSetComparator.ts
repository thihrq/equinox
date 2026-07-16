import { toCompetitiveId } from '../../../equinox/data-normalization/CompetitiveDataNormalizer';
import type {
  ActiveV2ShadowPokemonComparison,
  ActiveV2ShadowSuggestedPokemon,
} from './ActiveV2RuntimeShadowTypes';
import type { CompetitiveClassification } from '../acceptance/ActiveV2AcceptanceTypes';

export interface ActiveV2ShadowV2SetFields {
  item: string;
  ability: string;
  nature: string;
  moves: string[];
}

function normalizedSet(values: string[]): Set<string> {
  return new Set(values.map(toCompetitiveId));
}

function movesMatch(a: string[], b: string[]): boolean {
  const setA = normalizedSet(a);
  const setB = normalizedSet(b);
  if (setA.size !== setB.size) return false;
  for (const move of setA) {
    if (!setB.has(move)) return false;
  }
  return true;
}

/**
 * Compara os campos disponíveis na resposta do baseline (item, ability,
 * nature, moves) contra um set ativo do Active V2 para o mesmo Pokémon.
 * Deliberadamente NÃO compara EVs/IVs — o pipeline de `/api/team/suggest`
 * nunca os calcula (ver `PokemonData`), então não há nada real para
 * comparar; inventar valores para preencher a lacuna seria menos honesto
 * do que simplesmente não comparar o que não existe.
 */
export function compareBaselineAndV2Set(
  baseline: ActiveV2ShadowSuggestedPokemon,
  v2Set: ActiveV2ShadowV2SetFields | null
): ActiveV2ShadowPokemonComparison {
  if (!v2Set) {
    return { pokemonName: baseline.name, outcome: 'no-v2-data', divergentFields: [] };
  }

  const divergentFields: string[] = [];
  if (toCompetitiveId(baseline.item) !== toCompetitiveId(v2Set.item)) divergentFields.push('item');
  if (toCompetitiveId(baseline.ability) !== toCompetitiveId(v2Set.ability)) divergentFields.push('ability');
  if (toCompetitiveId(baseline.nature) !== toCompetitiveId(v2Set.nature)) divergentFields.push('nature');
  if (!movesMatch(baseline.moves, v2Set.moves)) divergentFields.push('moves');

  return {
    pokemonName: baseline.name,
    outcome: divergentFields.length === 0 ? 'match' : 'diverged',
    divergentFields,
  };
}

export interface ActiveV2ShadowRequestClassification {
  classification: CompetitiveClassification;
  fallbackTriggered: boolean;
}

/**
 * Agrega as comparações por Pokémon (tipicamente 3, o time principal
 * sugerido) em uma única classificação por requisição. Só emite
 * `equivalent` ou `acceptable-divergence` — nunca `blocker`/`regression`/
 * `improvement`/`human-review-needed`, porque este comparador não tem
 * uma métrica de força de time para justificar essas classificações mais
 * fortes (ao contrário do `ActiveV2AcceptanceClassifier`, que opera sobre
 * evidência de shadow comparison completa, com score).
 */
export function classifyActiveV2ShadowComparisons(
  comparisons: readonly ActiveV2ShadowPokemonComparison[]
): ActiveV2ShadowRequestClassification {
  const fallbackTriggered = comparisons.some(comparison => comparison.outcome === 'no-v2-data');
  const allMatched = comparisons.length > 0 && comparisons.every(comparison => comparison.outcome === 'match');

  return {
    classification: allMatched ? 'equivalent' : 'acceptable-divergence',
    fallbackTriggered,
  };
}
