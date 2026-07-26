import snapshotData from './fixtures/production-charizard-whimsicott-candidate-snapshot.json';

export interface ProductionCandidateSnapshot {
  candidateId: string;
  species: string;
  canonicalSpecies?: string;
  form?: string;
  setId: string;

  types: readonly string[];
  item?: string;
  ability?: string;
  nature?: string;

  evs?: Readonly<Record<string, number>>;
  ivs?: Readonly<Record<string, number>>;
  moves?: readonly string[];

  acceptedByHardFilter: boolean;
  hardFilterReasons: readonly string[];

  categories: readonly string[];
}

export interface ProductionLeadBuildSnapshot {
  sourceCommit: string;
  artifactDigest: string;
  runtimeProfile: string;
  environment: string;

  format: string;
  lead: readonly string[];

  candidateSourceMode: string;
  candidateQueryVersion: string;
  candidateFilterVersion: string;

  competitivePackageDigest: string;
  competitiveSetDigest: string;
  pokemonDocumentCount: number;
  competitiveSetCount: number;

  rawCandidateCount: number;
  usableCandidateCount: number;
  sourceExhausted: boolean;

  rawCandidates: readonly ProductionCandidateSnapshot[];
}

export function loadProductionSnapshot(): ProductionLeadBuildSnapshot {
  return snapshotData as unknown as ProductionLeadBuildSnapshot;
}
