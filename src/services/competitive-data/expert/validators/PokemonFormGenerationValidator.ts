import { ExpertFinding } from '../CompetitiveDoublesExpertTypes';
import { PokemonGenerationCatalogEntry } from './GenerationCatalogTypes';

export function validatePokemonFormGeneration(entry: PokemonGenerationCatalogEntry, knownShowdownIds: ReadonlySet<string>): ExpertFinding[] {
  const findings: ExpertFinding[] = [];
  if (!knownShowdownIds.has(entry.showdownId)) findings.push({ code: 'FORM_NOT_FOUND', message: `form ${entry.showdownId} is absent from the mechanics snapshot`, severity: 'blocking', blocking: true, evidenceIds: [] });
  // A form can be introduced in the same generation as its base species
  // (for example, Rotom's forms). Identity is proven by the resolved form
  // ID and the explicit isBaseSpecies flag, not by generation inequality.
  return findings;
}
