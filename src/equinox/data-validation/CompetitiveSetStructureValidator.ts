import { completeSpread, CompetitiveSetValidationInput, issue, result, STAT_KEYS, DataValidationResult } from './CompetitiveValidationTypes';

export function validateCompetitiveSetStructure(input: CompetitiveSetValidationInput): DataValidationResult {
  const errors = [];
  const warnings = [];

  if (!input.pokemonName && !input.pokemonId) errors.push(issue('MISSING_POKEMON', 'error', 'pokemonId', 'Pokemon is required.'));
  if (!input.formId) errors.push(issue('MISSING_FORM', 'error', 'formId', 'Canonical formId is required.'));
  if (!input.formatId) errors.push(issue('MISSING_FORMAT', 'error', 'formatId', 'Format is required.'));
  if (!input.regulationId) errors.push(issue('MISSING_REGULATION', 'error', 'regulationId', 'Regulation is required.'));
  if (input.battleStyle !== 'singles' && input.battleStyle !== 'doubles') {
    errors.push(issue('MISSING_BATTLE_STYLE', 'error', 'battleStyle', 'Battle style must be singles or doubles.'));
  }
  if (!input.item) errors.push(issue('MISSING_ITEM', 'error', 'item', 'Item is required.'));
  if (!input.ability) errors.push(issue('MISSING_ABILITY', 'error', 'ability', 'Ability is required.'));
  if (!input.nature) errors.push(issue('MISSING_NATURE', 'error', 'nature', 'Nature is required.'));
  if (!input.moves || input.moves.length !== 4 || input.moves.some(move => !move)) {
    errors.push(issue('INVALID_MOVE_COUNT', 'error', 'moves', 'Exactly four moves are required.'));
  }
  if (!input.evs) errors.push(issue('MISSING_EVS', 'error', 'evs', 'EV spread is required.'));
  if (!input.ivs) errors.push(issue('MISSING_IVS', 'error', 'ivs', 'IV spread is required.'));
  if (!input.sourceId) errors.push(issue('MISSING_SOURCE', 'error', 'sourceId', 'Source id is required.'));
  if (!input.dataVersion) errors.push(issue('MISSING_DATA_VERSION', 'error', 'dataVersion', 'Data version is required.'));
  if (typeof input.confidence !== 'number') errors.push(issue('MISSING_CONFIDENCE', 'error', 'confidence', 'Confidence is required.'));
  if (!input.sourceUpdatedAt) warnings.push(issue('MISSING_SOURCE_DATE', 'warning', 'sourceUpdatedAt', 'Source date is required for trusted sets.'));

  const evs = completeSpread(input.evs, 0);
  const ivs = completeSpread(input.ivs, 31);
  const evTotal = STAT_KEYS.reduce((sum, key) => sum + evs[key], 0);

  if (evTotal > 510) errors.push(issue('EV_TOTAL_EXCEEDED', 'error', 'evs', 'EV total cannot exceed 510.'));
  for (const key of STAT_KEYS) {
    if (evs[key] < 0 || evs[key] > 252) errors.push(issue('EV_OUT_OF_RANGE', 'error', `evs.${key}`, 'EV must be between 0 and 252.'));
    if (ivs[key] < 0 || ivs[key] > 31) errors.push(issue('IV_OUT_OF_RANGE', 'error', `ivs.${key}`, 'IV must be between 0 and 31.'));
  }

  return result(errors, warnings);
}
