export type BattleStyle = 'singles' | 'doubles';
export type CompetitiveSetStatus = 'active' | 'verified' | 'reviewed' | 'deprecated' | 'quarantined' | 'draft';

export interface StatSpread {
  hp?: number;
  atk?: number;
  def?: number;
  spa?: number;
  spd?: number;
  spe?: number;
}

export interface DataValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface DataValidationResult {
  valid: boolean;
  errors: DataValidationIssue[];
  warnings: DataValidationIssue[];
}

export interface CompetitiveSetValidationInput {
  pokemonName?: string;
  pokemonId?: string;
  formId?: string;
  gameFamily?: string;
  gameVersion?: string;
  formatId?: string;
  regulationId?: string;
  battleStyle?: BattleStyle;
  setId?: string;
  setName?: string;
  item?: string;
  ability?: string;
  nature?: string;
  evs?: StatSpread;
  ivs?: StatSpread;
  moves?: string[];
  primaryRole?: string;
  secondaryRoles?: string[];
  archetypes?: string[];
  synergyTags?: string[];
  sourceId?: string;
  sourceType?: string;
  sourceUpdatedAt?: string | Date;
  importedAt?: string | Date;
  confidence?: number;
  dataVersion?: string;
  contentHash?: string;
  legal?: boolean;
  status?: CompetitiveSetStatus;
  coherenceScore?: number;
  eligibleRoster?: Array<{ pokemonId: string; forms: string[] }>;
}

export function issue(
  code: string,
  severity: 'error' | 'warning',
  path: string,
  message: string,
): DataValidationIssue {
  return { code, severity, path, message };
}

export function result(errors: DataValidationIssue[], warnings: DataValidationIssue[]): DataValidationResult {
  return { valid: errors.length === 0, errors, warnings };
}

export function completeSpread(spread: StatSpread | undefined, fallback: number): Required<StatSpread> {
  return {
    hp: Number(spread?.hp ?? fallback),
    atk: Number(spread?.atk ?? fallback),
    def: Number(spread?.def ?? fallback),
    spa: Number(spread?.spa ?? fallback),
    spd: Number(spread?.spd ?? fallback),
    spe: Number(spread?.spe ?? fallback),
  };
}

export const STAT_KEYS: Array<keyof StatSpread> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
