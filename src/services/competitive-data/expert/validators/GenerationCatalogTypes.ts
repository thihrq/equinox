import { ExpertFinding, ExpertEvidence } from '../CompetitiveDoublesExpertTypes';

export type GenerationVerificationStatus = 'cross-source-verified' | 'primary-source-verified' | 'provisional' | 'conflict';

export interface PokemonGenerationCatalogEntry {
  pokemonId: string;
  speciesId: string;
  formId?: string;
  showdownId: string;
  nationalDexNumber: number;
  speciesGeneration: number;
  formGeneration: number;
  introducedGeneration: number;
  isBaseSpecies: boolean;
  isRegionalForm: boolean;
  isMega: boolean;
  isAlternativeForm: boolean;
  rosterVerified: boolean;
  mechanicsVerified: boolean;
  verificationStatus: GenerationVerificationStatus;
  sourceEvidence: ExpertEvidence[];
  entryDigest: string;
}

export interface ChampionsGenerationCatalog {
  catalogVersion: string;
  sourceRevision: string;
  packageDigest: string;
  mechanicsSourceRevision: string;
  entries: PokemonGenerationCatalogEntry[];
  catalogDigest: string;
}

export interface GenerationValidationResult {
  pokemonId: string;
  speciesGenerationResolved: boolean;
  formGenerationResolved: boolean;
  speciesGeneration?: number;
  formGeneration?: number;
  introducedGeneration?: number;
  rosterVerified: boolean;
  mechanicsVerified: boolean;
  valid: boolean;
  blockers: ExpertFinding[];
  warnings: ExpertFinding[];
}

