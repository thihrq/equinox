import { ExpertDecision } from './CompetitiveDoublesExpertTypes';

declare const process: { env: Record<string, string | undefined> };

export const COMPETITIVE_DOUBLES_EXPERT_POLICY_VERSION = 'champions-mb-automated-expert-validation-v1';
export const GENERATION_CATALOG_VERSION = 'champions-mb-generation-catalog-v1';
export const DAMAGE_FORMULA_VERSION = 'damage-formula-v1-contract';
export const SPEED_FORMULA_VERSION = 'speed-formula-v1-contract';
export const SCENARIO_POLICY_VERSION = 'doubles-scenario-v1-contract';
export const BENCHMARK_POLICY_VERSION = 'competitive-benchmark-v1-contract';

export interface ChampionsExpertValidationFlags {
  enabled: boolean;
  validationOnly: boolean;
  networkReads: boolean;
  databaseWrites: boolean;
  regulationId: string;
  damageEngine: boolean;
  speedEngine: boolean;
  teamScenarioEngine: boolean;
  competitiveBenchmarkEngine: boolean;
}

function strictTrue(value: string | undefined): boolean { return value === 'true'; }

export function getChampionsExpertValidationFlags(env = process.env): ChampionsExpertValidationFlags {
  return {
    enabled: strictTrue(env.EQUINOX_ENABLE_CHAMPIONS_EXPERT_VALIDATION),
    validationOnly: strictTrue(env.EQUINOX_CHAMPIONS_EXPERT_VALIDATION_ONLY),
    networkReads: strictTrue(env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS),
    databaseWrites: strictTrue(env.EQUINOX_ALLOW_DATABASE_WRITES),
    regulationId: env.EQUINOX_CHAMPIONS_REGULATION_ID ?? '',
    damageEngine: strictTrue(env.EQUINOX_ENABLE_DAMAGE_ENGINE),
    speedEngine: strictTrue(env.EQUINOX_ENABLE_SPEED_ENGINE),
    teamScenarioEngine: strictTrue(env.EQUINOX_ENABLE_TEAM_SCENARIO_ENGINE),
    competitiveBenchmarkEngine: strictTrue(env.EQUINOX_ENABLE_COMPETITIVE_BENCHMARK_ENGINE),
  };
}

export function assertChampionsExpertValidationFlags(env = process.env): ChampionsExpertValidationFlags {
  const flags = getChampionsExpertValidationFlags(env);
  if (!flags.enabled) throw new Error('CHAMPIONS_EXPERT_VALIDATION_DISABLED');
  if (!flags.validationOnly) throw new Error('CHAMPIONS_EXPERT_VALIDATION_MODE_REQUIRED');
  if (flags.networkReads) throw new Error('CHAMPIONS_EXPERT_NETWORK_MUST_BE_DISABLED');
  if (flags.databaseWrites) throw new Error('CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
  if (flags.regulationId !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  return flags;
}

export function assertExpertContractsOnly(flags: ChampionsExpertValidationFlags): void {
  if (flags.damageEngine || flags.speedEngine || flags.teamScenarioEngine || flags.competitiveBenchmarkEngine) {
    throw new Error('CHAMPIONS_EXPERT_ENGINES_MUST_BE_DISABLED_FOR_CONTRACT_CHECK');
  }
}

export function isHumanReviewRequired(decision: ExpertDecision): boolean {
  return decision === 'expert-review-required';
}
