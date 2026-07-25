import { assertCandidateEvidenceFlags } from './championsCandidateEvidenceFlags';

const base = { EQUINOX_ENABLE_CHAMPIONS_CANDIDATE_EVIDENCE: 'true', EQUINOX_CHAMPIONS_CANDIDATE_EVIDENCE_ONLY: 'true', EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'false', EQUINOX_ALLOW_DATABASE_WRITES: 'false', EQUINOX_CHAMPIONS_REGULATION_ID: 'M-B', EQUINOX_ENABLE_DAMAGE_ENGINE: 'true', EQUINOX_ENABLE_SPEED_ENGINE: 'true', EQUINOX_ENABLE_TEAM_SCENARIO_ENGINE: 'true', EQUINOX_ENABLE_COMPETITIVE_BENCHMARK_ENGINE: 'true' };
assertCandidateEvidenceFlags(base);
for (const key of ['EQUINOX_ENABLE_CHAMPIONS_CANDIDATE_EVIDENCE', 'EQUINOX_CHAMPIONS_CANDIDATE_EVIDENCE_ONLY', 'EQUINOX_CHAMPIONS_REGULATION_ID'] as const) {
  const copy = { ...base, [key]: key === 'EQUINOX_CHAMPIONS_REGULATION_ID' ? 'A' : 'false' };
  let blocked = false;
  try { assertCandidateEvidenceFlags(copy); } catch { blocked = true; }
  if (!blocked) throw new Error(`CANDIDATE_EVIDENCE_FLAG_NOT_FAIL_CLOSED:${key}`);
}
let blockedNetwork = false;
try { assertCandidateEvidenceFlags({ ...base, EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS: 'true' }); } catch { blockedNetwork = true; }
if (!blockedNetwork) throw new Error('CANDIDATE_EVIDENCE_NETWORK_GUARD_FAILED');
let blockedWrites = false;
try { assertCandidateEvidenceFlags({ ...base, EQUINOX_ALLOW_DATABASE_WRITES: 'true' }); } catch { blockedWrites = true; }
if (!blockedWrites) throw new Error('CANDIDATE_EVIDENCE_WRITE_GUARD_FAILED');
console.log('candidate evidence flags tests passed');
