export type EvidenceAuthority =
  | 'official'
  | 'canonical-mechanics'
  | 'in-game-verified'
  | 'community'
  | 'agent-generated'
  | 'human-reviewed';

export type MechanicsVerificationStatus =
  | 'official-verified'
  | 'primary-source-verified'
  | 'in-game-verified'
  | 'cross-source-verified'
  | 'provisional'
  | 'unknown';

export type ChampionsPackageStatus = 'pending' | 'ready' | 'blocked';
export type ChampionsPackageState = 'empty' | 'partial' | 'ready' | 'invalid';

export interface FieldEvidence {
  field: string;
  authority: EvidenceAuthority;
  sourceId: string;
  sourceDigest: string;
  retrievedAt: string;
  verifiedAt?: string;
}

export interface ChampionsRegulation {
  formatId: 'champions_reg_m_b_doubles';
  regulationId: 'M-B';
  battleType: 'doubles';
  validFrom: string;
  validUntil: string;
  itemClause: true;
  maxMegaEvolutionsPerBattle: 1;
  teamSize: 6;
  bringCount: 4;
  schemaVersion: '1';
}

export interface ChampionsRosterEntry {
  pokemonId: string;
  speciesId: string;
  displayName: string;
  formId?: string;
  legal: boolean;
  regulationId: 'M-B';
  verificationStatus: MechanicsVerificationStatus;
  sourceEvidence: FieldEvidence[];
}

export interface ChampionsSpeciesRecord {
  pokemonId: string;
  types: string[];
  abilities: string[];
  baseStats: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  evidence: FieldEvidence[];
}

export interface ChampionsMoveRecord {
  moveId: string;
  displayName: string;
  type: string;
  category: 'physical' | 'special' | 'status';
  power: number | null;
  accuracy: number | null;
  priority: number;
  globallyAvailableInRegulation: boolean;
  verificationStatus: MechanicsVerificationStatus;
  sourceEvidence: FieldEvidence[];
}

export interface ChampionsAbilityRecord {
  abilityId: string;
  displayName: string;
  description?: string;
  globallyAvailableInRegulation: boolean;
  verificationStatus: MechanicsVerificationStatus;
  sourceEvidence: FieldEvidence[];
}

export interface ChampionsItemRecord {
  itemId: string;
  displayName: string;
  category: 'held-item' | 'mega-stone' | 'other';
  legal: boolean;
  uniquePerTeam: boolean;
  compatiblePokemonIds?: string[];
  verificationStatus: MechanicsVerificationStatus;
  sourceEvidence: FieldEvidence[];
}

export interface ChampionsLearnsetRecord {
  pokemonId: string;
  formId?: string;
  legalMoveIds: string[];
  legalAbilityIds: string[];
  legalItemIds?: string[];
  verificationStatus: MechanicsVerificationStatus;
  evidenceDigest: string;
  sourceEvidence: FieldEvidence[];
}

export interface ChampionsSourceManifest {
  packageId: string;
  packageVersion: string;
  status: ChampionsPackageStatus;
  generatedAt: string;
  sources: Array<{
    sourceId: string;
    authority: EvidenceAuthority;
    url: string;
    retrievedAt: string;
    digest: string;
    scope: string[];
  }>;
  packageDigest: string;
}

export interface ChampionsRestrictions {
  itemClause: true;
  maxMegaEvolutionsPerBattle: 1;
  restrictedItems: string[];
  bannedCombinations: string[];
}

export interface ChampionsCompetitivePackage {
  regulation: ChampionsRegulation;
  roster: ChampionsRosterEntry[];
  species: ChampionsSpeciesRecord[];
  moves: ChampionsMoveRecord[];
  abilities: ChampionsAbilityRecord[];
  items: ChampionsItemRecord[];
  learnsets: ChampionsLearnsetRecord[];
  restrictions: ChampionsRestrictions;
  sourceManifest: ChampionsSourceManifest;
}

export interface ChampionsValidationFinding {
  scope: string;
  code: string;
  message: string;
  blocking: boolean;
}

export interface ChampionsPackageValidationResult {
  packageState: ChampionsPackageState;
  rosterRecordsRead: number;
  moveRecordsRead: number;
  abilityRecordsRead: number;
  itemRecordsRead: number;
  learnsetRecordsRead: number;
  packageValid: boolean;
  generationEligible: boolean;
  status: ChampionsPackageStatus;
  errors: string[];
  warnings: string[];
  eligiblePokemonIds: string[];
  provisionalPokemonIds: string[];
  blockedPokemonIds: string[];
  blockers: ChampionsValidationFinding[];
  findings: ChampionsValidationFinding[];
}
