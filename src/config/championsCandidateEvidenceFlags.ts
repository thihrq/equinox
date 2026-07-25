export interface CandidateEvidenceFlags {
  enabled: boolean;
  evidenceOnly: boolean;
  networkReads: boolean;
  databaseWrites: boolean;
  regulationId: string;
  damageEngine: boolean;
  speedEngine: boolean;
  scenarioEngine: boolean;
  benchmarkEngine: boolean;
}

const strictTrue = (value: string | undefined): boolean => value === 'true';

export function getCandidateEvidenceFlags(env: Record<string, string | undefined>): CandidateEvidenceFlags {
  return { enabled: strictTrue(env.EQUINOX_ENABLE_CHAMPIONS_CANDIDATE_EVIDENCE), evidenceOnly: strictTrue(env.EQUINOX_CHAMPIONS_CANDIDATE_EVIDENCE_ONLY), networkReads: strictTrue(env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS), databaseWrites: strictTrue(env.EQUINOX_ALLOW_DATABASE_WRITES), regulationId: env.EQUINOX_CHAMPIONS_REGULATION_ID ?? '', damageEngine: strictTrue(env.EQUINOX_ENABLE_DAMAGE_ENGINE), speedEngine: strictTrue(env.EQUINOX_ENABLE_SPEED_ENGINE), scenarioEngine: strictTrue(env.EQUINOX_ENABLE_TEAM_SCENARIO_ENGINE), benchmarkEngine: strictTrue(env.EQUINOX_ENABLE_COMPETITIVE_BENCHMARK_ENGINE) };
}

export function assertCandidateEvidenceFlags(env: Record<string, string | undefined>): CandidateEvidenceFlags {
  const flags = getCandidateEvidenceFlags(env);
  if (!flags.enabled) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_DISABLED');
  if (!flags.evidenceOnly) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_MODE_REQUIRED');
  if (flags.networkReads) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_NETWORK_MUST_BE_DISABLED');
  if (flags.databaseWrites) throw new Error('CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
  if (flags.regulationId !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  if (!flags.damageEngine || !flags.speedEngine || !flags.scenarioEngine || !flags.benchmarkEngine) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_ENGINES_REQUIRED');
  return flags;
}
