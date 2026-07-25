import { ExpertFinding } from '../CompetitiveDoublesExpertTypes';
import { GenerationValidationResult, PokemonGenerationCatalogEntry } from './GenerationCatalogTypes';

function finding(code: string, message: string, blocking: boolean): ExpertFinding {
  return { code, message, severity: blocking ? 'blocking' : 'warning', blocking, evidenceIds: [] };
}

export function validatePokemonGeneration(entry: PokemonGenerationCatalogEntry): GenerationValidationResult {
  const blockers: ExpertFinding[] = [];
  const warnings: ExpertFinding[] = [];
  if (!entry.pokemonId || !entry.speciesId) blockers.push(finding('SPECIES_ID_MISSING', 'pokemonId and speciesId are required', true));
  if (!Number.isInteger(entry.speciesGeneration) || entry.speciesGeneration < 1) blockers.push(finding('GENERATION_INVALID_VALUE', 'speciesGeneration must be a positive integer', true));
  if (!Number.isInteger(entry.formGeneration) || entry.formGeneration < 1) blockers.push(finding('FORM_GENERATION_INVALID_VALUE', 'formGeneration must be a positive integer', true));
  if (!Number.isInteger(entry.introducedGeneration) || entry.introducedGeneration < 1) blockers.push(finding('INTRODUCED_GENERATION_INVALID_VALUE', 'introducedGeneration must be a positive integer', true));
  if (entry.isMega && entry.formGeneration !== 6) blockers.push(finding('GENERATION_FORM_MISMATCH', 'Mega forms must resolve to formGeneration 6', true));
  if (entry.verificationStatus === 'conflict') blockers.push(finding('GENERATION_SOURCE_CONFLICT', 'generation sources conflict', true));
  if (!entry.rosterVerified) blockers.push(finding('ROSTER_NOT_VERIFIED', 'roster evidence is not verified', true));
  if (!entry.mechanicsVerified) warnings.push(finding('MECHANICS_NOT_RESOLVED', 'mechanics are not fully resolved for this roster entry', false));
  return {
    pokemonId: entry.pokemonId,
    speciesGenerationResolved: Number.isInteger(entry.speciesGeneration),
    formGenerationResolved: Number.isInteger(entry.formGeneration),
    speciesGeneration: entry.speciesGeneration,
    formGeneration: entry.formGeneration,
    introducedGeneration: entry.introducedGeneration,
    rosterVerified: entry.rosterVerified,
    mechanicsVerified: entry.mechanicsVerified,
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
}
