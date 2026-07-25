export type ChampionsSourceAuthority = 'official' | 'canonical-mechanics' | 'community-crosscheck';

export type ChampionsSourceScope =
  | 'regulation'
  | 'roster'
  | 'species'
  | 'forms'
  | 'moves'
  | 'abilities'
  | 'items'
  | 'learnsets';

export interface ChampionsRawSnapshotManifest {
  snapshotId: string;
  regulationId: 'M-B';
  retrievedAt: string;
  importerVersion: string;
  normalizerVersion: string;
  sources: Array<{
    sourceId: string;
    authority: ChampionsSourceAuthority;
    scope: ChampionsSourceScope[];
    sourceReference: string;
    rawDigest: string;
    retrievalStatus: 'success' | 'partial' | 'failed';
  }>;
}

export interface ChampionsMechanicsSource {
  sourceId: string;
  sourceVersion: string;
  loadSpecies(): Promise<unknown[]>;
  loadMoves(): Promise<unknown[]>;
  loadAbilities(): Promise<unknown[]>;
  loadItems(): Promise<unknown[]>;
  loadLearnsets(): Promise<unknown[]>;
}

export interface ChampionsSourceConflict {
  recordType: ChampionsSourceScope;
  recordId: string;
  fields: string[];
  sources: string[];
  resolution: 'human-review-required' | 'official-wins' | 'mechanics-wins';
}

export interface ChampionsSourceCoverageReport {
  snapshotId: string;
  rosterCount: number;
  speciesResolved: number;
  formsResolved: number;
  movesCount: number;
  abilitiesCount: number;
  itemsCount: number;
  learnsetsCount: number;
  eligibleCount: number;
  provisionalCount: number;
  blockedCount: number;
  unresolvedAliases: string[];
  missingLearnsets: string[];
  missingAbilities: string[];
  sourceConflicts: ChampionsSourceConflict[];
  generationEnabled: boolean;
}
