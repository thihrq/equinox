import { ChampionsCompetitivePackage } from '../../../equinox/data-packs/champions/ChampionsPackageTypes';

export type CurationDisposition = 'agent-reviewed' | 'human-review-required' | 'rejected';
export type CurationCategory = 'mega' | 'trick-room' | 'tailwind' | 'physical' | 'special' | 'support' | 'pivot' | 'weather' | 'multiple-abilities' | 'alternate-form';

export interface CurationConfig {
  snapshotId: string;
  regulationId: 'M-B';
  pokemonLimit: number;
  candidatesPerPokemon: number;
  seed: string;
  packageDigest: string;
  package: ChampionsCompetitivePackage;
}

export interface SentinelSelection {
  sentinelRunId: string;
  snapshotId: string;
  regulationId: 'M-B';
  packageDigest: string;
  eligiblePoolDigest: string;
  seed: string;
  policyVersion: string;
  selectedPokemonIds: string[];
  representedCategories: CurationCategory[];
  missingCategories: CurationCategory[];
  blockers: string[];
  warnings: string[];
}

export interface CurationSetDraft {
  setId: string;
  pokemonId: string;
  formatId: 'champions_reg_m_b_doubles';
  itemId: string;
  abilityId: string;
  natureId: string;
  evs: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  ivs: Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>;
  moveIds: [string, string, string, string];
  declaredRoles: string[];
  targetArchetypes: string[];
  rationale: string;
  sourceType: 'generated';
  status: 'draft';
  humanReviewed: false;
  automaticPromotionAllowed: false;
  provenance: {
    sourceSnapshotDigest: string;
    packageDigest: string;
    curationRunId: string;
    generatorAgentId: string;
    generatorVersion: string;
    inputDigest: string;
    candidateDigest: string;
  };
}

export interface CurationFinding { setId: string; code: string; message: string; blocking: boolean; }
export interface CandidateReview { setId: string; legal: boolean; coherent: boolean; rolesSupported: boolean; findings: CurationFinding[]; }
export interface MatchupScenario { scenarioId: string; setId: string; result: 'favorable' | 'neutral' | 'adverse'; outcome: 'supports-candidate' | 'mixed' | 'does-not-support-candidate'; opposingPokemonIds: string[]; partnerPokemonIds: string[]; assumptions: string[]; limitations: string[]; evidenceLevel: 'agent-scenario-review'; }
export interface FullTeamEvaluation { setId: string; basePokemonIds: string[]; recommendedPokemonIds: string[]; teamIds: string[]; structureId: string; identity: string; score: number; legal: boolean; findings: string[]; }
export interface CurationRunManifest {
  sentinelRunId: string;
  snapshotId: string;
  packageDigest: string;
  policyVersion: string;
  selectedCount: number;
  draftCount: number;
  dispositions: Record<CurationDisposition, number>;
  mongoReads: 0;
  mongoWrites: 0;
  productionWrites: 0;
  generatedSetsRemainDraft: true;
  completedAt: string;
}
