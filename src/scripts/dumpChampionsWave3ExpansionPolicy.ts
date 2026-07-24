import fs from 'fs';
import path from 'path';
import { FULL_ROSTER_EXPANSION_POLICY, assertFullRosterExpansionPolicyConsistency } from '../services/competitive-data/expert/wave3/FullRosterExpansionPolicy';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function main(): void {
  const allowed = new Set(['--run-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = path.resolve(`artifacts/competitive-production-readiness/${runId}/policy`);

  let consistencyError: string | null = null;
  try { assertFullRosterExpansionPolicyConsistency(FULL_ROSTER_EXPANSION_POLICY); } catch (error) { consistencyError = error instanceof Error ? error.message : String(error); }

  writeAtomic(path.join(outputDir, 'full-roster-expansion-policy.json'), { runId, policy: FULL_ROSTER_EXPANSION_POLICY });
  writeAtomic(path.join(outputDir, 'policy-consistency.json'), { runId, consistencyCheckPassed: consistencyError === null, error: consistencyError });
  writeAtomic(path.join(outputDir, 'reason-codes.json'), { runId, resumeReasonCodes: FULL_ROSTER_EXPANSION_POLICY.resumePolicy.reasonCodes, reasonCodeMappings: FULL_ROSTER_EXPANSION_POLICY.reasonCodeMappings, retryClasses: FULL_ROSTER_EXPANSION_POLICY.failurePolicy.retryClasses });
  writeAtomic(path.join(outputDir, 'policy-spec.md'), `# FullRosterExpansionPolicy Spec\n\nRun ID: \`${runId}\`\n\n- policyId: \`${FULL_ROSTER_EXPANSION_POLICY.policyId}\`\n- policyVersion: \`${FULL_ROSTER_EXPANSION_POLICY.policyVersion}\`\n- maxCandidatesPerPokemon: ${FULL_ROSTER_EXPANSION_POLICY.maxCandidatesPerPokemon}\n- batchPolicy.speciesPerBatch: ${FULL_ROSTER_EXPANSION_POLICY.batchPolicy.speciesPerBatch} (${FULL_ROSTER_EXPANSION_POLICY.batchPolicy.rationale})\n- failurePolicy.maxRetryAttempts: ${FULL_ROSTER_EXPANSION_POLICY.failurePolicy.maxRetryAttempts}\n- packageInclusionPolicy.includedVerdicts: ${FULL_ROSTER_EXPANSION_POLICY.packageInclusionPolicy.includedVerdicts.join(', ')}\n- verdictPolicyVersion: \`${FULL_ROSTER_EXPANSION_POLICY.verdictPolicyVersion}\` (references, does not duplicate, ExpertVerdictAggregationPolicy.ts)\n- targetSelectionPolicyVersion: \`${FULL_ROSTER_EXPANSION_POLICY.targetSelectionPolicyVersion}\` (references Wave 2)\n- scenarioPolicyVersion: \`${FULL_ROSTER_EXPANSION_POLICY.scenarioPolicyVersion}\` (references Wave 2)\n- partnerSelectionPolicyVersion: \`${FULL_ROSTER_EXPANSION_POLICY.partnerSelectionPolicyVersion}\` (references Wave 2)\n- consistencyCheckPassed: ${consistencyError === null}\n`);

  console.log(JSON.stringify({ valid: consistencyError === null, policyId: FULL_ROSTER_EXPANSION_POLICY.policyId, policyVersion: FULL_ROSTER_EXPANSION_POLICY.policyVersion, consistencyError, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (consistencyError) process.exitCode = 7;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    if (process.exitCode === undefined) { console.error(error instanceof Error ? error.message : error); process.exitCode = 32; }
  }
}
