import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

declare const process: { argv: string[]; exitCode?: number };
const root = path.resolve('artifacts/champions-curation/mb/champions-mb-sentinel-champions-mb-sentinel-v1');
const targetCatalogPath = path.resolve('artifacts/competitive-finalization/targets/target-set-evidence-catalog.json');
const evidenceManifestPath = path.resolve('artifacts/competitive-expert/champions-candidate-evidence-champions-candidate-evidence-v1/run-manifest.json');
const rerunPath = path.resolve('artifacts/competitive-expert/champions-candidate-evidence-champions-candidate-evidence-v1/expert-rerun-results-champions-candidate-evidence-20260720-v4.json');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as T;
const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
try {
  const drafts = read<Array<{ setId: string; provenance: { candidateDigest: string; packageDigest: string; sourceSnapshotDigest: string } }>>('drafts.json');
  const scenarios = read<unknown[]>('matchups.json');
  const fullTeams = read<unknown[]>('full-team.json');
  const targetCatalog = JSON.parse(fs.readFileSync(targetCatalogPath, 'utf8')) as { records: unknown[]; policyVersion: string };
  const evidenceManifest = JSON.parse(fs.readFileSync(evidenceManifestPath, 'utf8')) as { completeCount: number; incompleteCount: number; targetSetCatalogDigest: string };
  const rerun = JSON.parse(fs.readFileSync(rerunPath, 'utf8')) as { summary: { expertValidatedCount: number; expertReviewRequiredCount: number; rejectedCount: number } };
  const evidenceGaps = evidenceManifest.incompleteCount > 0 ? ['candidate-evidence-incomplete'] : [];
  const baseline = { worktree: 'competitive-data-v2-clean', branch: 'feature/active-v2-production-publication-and-gates', commitBase: 'e9abeb5', candidateCount: drafts.length, targetCount: targetCatalog.records.length, targetSetPolicyVersion: targetCatalog.policyVersion, scenarioCount: scenarios.length, fullTeamEvaluationCount: fullTeams.length, evidenceGaps, specialistVerdicts: rerun.summary, candidateEvidenceCompleteCount: evidenceManifest.completeCount, targetSetCatalogDigest: evidenceManifest.targetSetCatalogDigest, candidateDigests: drafts.map(draft => ({ setId: draft.setId, candidateDigest: draft.provenance.candidateDigest, packageDigest: draft.provenance.packageDigest, sourceSnapshotDigest: draft.provenance.sourceSnapshotDigest })), packageDigest: drafts[0]?.provenance.packageDigest, provisionalCount: 32, mongoReads: 0, mongoWrites: 0, productionWrites: 0, draftsPromoted: 0, baselineDigest: digest({ drafts, targetCatalog, evidenceManifest, rerun }) };
  console.log(JSON.stringify(baseline, null, 2));
  if (process.argv.includes('--write')) {
    const output = path.resolve('artifacts/competitive-finalization/finalization-baseline.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`, { flag: 'wx' });
    console.log(`baseline=${output}`);
  }
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 15; }
