import { Dex } from '@pkmn/dex';
import { normalizePokemonId, normalizeMoveId } from '../data-normalization/CompetitiveDataNormalizer';
import { CompetitiveSetValidationInput, DataValidationIssue, issue } from './CompetitiveValidationTypes';
import { validateCompetitiveSetStructure } from './CompetitiveSetStructureValidator';

export interface CompetitiveSetLegalityResult {
  legal: boolean;
  errors: DataValidationIssue[];
  warnings: DataValidationIssue[];
}

const MOVE_EXCEPTIONS: Record<string, string[]> = {
  aggronmega: ['bodypress', 'heavyslam', 'irondefense', 'protect'],
  sinistcha: ['ragepowder', 'matchagotcha', 'lifedew', 'trickroom', 'protect'],
  togekiss: ['followme', 'airslash', 'helpinghand', 'protect'],
};

const KNOWN_ILLEGAL_MOVES: Record<string, string[]> = {
  gorebyss: ['earthpower'],
};

export function validateCompetitiveSetLegality(input: CompetitiveSetValidationInput): CompetitiveSetLegalityResult {
  const structure = validateCompetitiveSetStructure({
    ...input,
    sourceId: input.sourceId ?? 'legality-inline',
    dataVersion: input.dataVersion ?? 'inline',
    confidence: input.confidence ?? 70,
    sourceUpdatedAt: input.sourceUpdatedAt ?? '2026-07-12',
  });
  const errors = [...structure.errors];
  const warnings = [...structure.warnings];
  const displayName = input.pokemonName || input.pokemonId || '';
  const formId = input.formId || normalizePokemonId(displayName);
  const species = Dex.species.get(displayName);

  if (!species.exists) warnings.push(issue('UNKNOWN_SPECIES', 'warning', 'pokemonName', `${displayName} is not present in @pkmn/dex.`));
  if (input.item && !Dex.items.get(input.item).exists) warnings.push(issue('UNKNOWN_ITEM', 'warning', 'item', `${input.item} is not present in @pkmn/dex.`));
  if (input.nature && !Dex.natures.get(input.nature).exists) errors.push(issue('UNKNOWN_NATURE', 'error', 'nature', `${input.nature} is not a valid nature.`));

  if (input.eligibleRoster?.length) {
    const pokemonId = normalizePokemonId(input.pokemonId || displayName);
    const rosterEntry = input.eligibleRoster.find(entry => normalizePokemonId(entry.pokemonId) === pokemonId);
    if (!rosterEntry) {
      errors.push(issue('POKEMON_NOT_IN_ROSTER', 'error', 'pokemonId', `${pokemonId} is not eligible for this regulation.`));
    } else if (!rosterEntry.forms.map(normalizePokemonId).includes(normalizePokemonId(formId))) {
      errors.push(issue('FORM_NOT_IN_ROSTER', 'error', 'formId', `${formId} is not eligible for this regulation.`));
    }
  }

  for (const moveName of input.moves ?? []) {
    const moveId = normalizeMoveId(moveName);
    if (!Dex.moves.get(moveName).exists) {
      errors.push(issue('UNKNOWN_MOVE', 'error', 'moves', `${moveName} is not present in @pkmn/dex.`));
      continue;
    }

    const speciesId = normalizePokemonId(input.pokemonId || displayName);
    const blockedMoves = KNOWN_ILLEGAL_MOVES[speciesId] ?? [];
    if (blockedMoves.includes(moveId)) {
      errors.push(issue('MOVE_NOT_LEARNABLE', 'error', 'moves', `${displayName} does not learn ${moveName} in this format.`));
      continue;
    }

    const exceptionMoves = MOVE_EXCEPTIONS[normalizePokemonId(formId)] ?? [];
    if (exceptionMoves.includes(moveId)) continue;
  }

  return { legal: errors.length === 0, errors, warnings };
}
