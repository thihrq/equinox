import fs from 'fs';
import path from 'path';
import { EXPERT_VERDICT_AGGREGATION_POLICY } from '../services/competitive-data/expert/ExpertVerdictAggregationPolicy';
import { STAGE4_SPECIALIST_VERSIONS } from '../services/competitive-data/expert/Stage4SpecialistContracts';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

// Materializes the real in-memory policy object (imported, not retyped) to JSON, so
// aggregation-policy/policy.json can never silently drift from ExpertVerdictAggregationPolicy.ts --
// the source module's own assertPolicyConsistency() already runs at import time above.
function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId}/aggregation-policy`;

  writeAtomic(path.resolve(outputDir, 'policy.json'), EXPERT_VERDICT_AGGREGATION_POLICY);
  writeAtomic(path.resolve(outputDir, 'reason-codes.json'), {
    policyId: EXPERT_VERDICT_AGGREGATION_POLICY.policyId, policyVersion: EXPERT_VERDICT_AGGREGATION_POLICY.policyVersion,
    reasonCodeMappings: EXPERT_VERDICT_AGGREGATION_POLICY.reasonCodeMappings, defaults: EXPERT_VERDICT_AGGREGATION_POLICY.warningMaterialityRules,
  });
  writeAtomic(path.resolve(outputDir, 'specialist-contract-map.json'), {
    requiredSpecialists: EXPERT_VERDICT_AGGREGATION_POLICY.requiredSpecialists, specialistVersions: STAGE4_SPECIALIST_VERSIONS, specialistWeights: EXPERT_VERDICT_AGGREGATION_POLICY.specialistWeights,
  });
  console.log(JSON.stringify({ valid: true, runId, policyId: EXPERT_VERDICT_AGGREGATION_POLICY.policyId, policyVersion: EXPERT_VERDICT_AGGREGATION_POLICY.policyVersion, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }));
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
