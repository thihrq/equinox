export type OfficialWebRetrievalMethod = 'static-html' | 'embedded-json' | 'network-resource' | 'headless-browser';

export interface OfficialWebSnapshotSource {
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  httpStatus: number;
  retrievalMethod: OfficialWebRetrievalMethod;
  contentDigest: string;
  parserVersion: string;
}

export interface OfficialRegulationSnapshot {
  regulationId: 'M-B';
  validFrom: string;
  validUntil: string;
  eligiblePokemonUrl: string;
  itemClause: boolean;
  maxMegaEvolutionsPerBattle: number;
  timers?: {
    totalSeconds?: number;
    playerSeconds?: number;
    turnSeconds?: number;
    previewSeconds?: number;
  };
  source: OfficialWebSnapshotSource;
}

export interface OfficialEligiblePokemonRecord {
  pokemonId: string;
  displayName: string;
  formId?: string;
  source: OfficialWebSnapshotSource;
}
