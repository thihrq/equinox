import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { assertCandidateEvidenceFlags } from '../config/championsCandidateEvidenceFlags';
import { validateCandidateWithExperts } from '../services/competitive-data/expert/Stage4ExpertOrchestrator';
import { loadStage4SentinelContexts } from '../services/competitive-data/expert/Stage4SentinelData';

declare const process: { env: Record<string, string | undefined>; exitCode?: number };
const evidenceRoot = path.resolve('artifacts/competitive-expert/champions-candidate-evidence-champions-candidate-evidence-v1');
const output = path.resolve('artifacts/competitive-expert/champions-candidate-evidence-champions-candidate-evidence-v1/expert-rerun-results.json');
const digest = (value: unknown): string => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

function writeRunArtifact(value: unknown): string {
  const runId = process.env.EQUINOX_EVIDENCE_RUN_ID ?? 'champions-candidate-evidence-v1';
  const versionedOutput = output.replace(/\.json$/, `-${runId}.json`);
  fs.writeFileSync(versionedOutput, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return versionedOutput;
}

function main(): void {
  assertCandidateEvidenceFlags(process.env);
  const packages = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'candidate-evidence-packages.json'), 'utf8')) as Array<{ candidateId: string; damageEvidence: { complete: boolean }; speedEvidence: { complete: boolean }; scenarioEvidence: { complete: boolean; scenarios: unknown[] }; fullTeamEvidence: { complete: boolean; structures: unknown[] }; benchmarkEvidence: { complete: boolean } }>;
  const packageById = new Map(packages.map(item => [item.candidateId, item]));
  const results = loadStage4SentinelContexts().map(context => {
    const evidence = packageById.get(context.candidate.candidateId);
    if (!evidence) throw new Error('CHAMPIONS_CANDIDATE_EVIDENCE_DIGEST_MISMATCH');
    return validateCandidateWithExperts({ ...context, damageEvidence: evidence.damageEvidence.complete, speedEvidence: evidence.speedEvidence.complete, scenarioEvidenceCount: evidence.scenarioEvidence.scenarios.length, fullTeamEvidenceCount: evidence.fullTeamEvidence.structures.length, benchmarkEvidence: evidence.benchmarkEvidence.complete });
  });
  const summary = { evidenceRunId: process.env.EQUINOX_EVIDENCE_RUN_ID ?? 'champions-candidate-evidence-v1', candidateCount: results.length, expertValidatedCount: results.filter(item => item.verdict === 'expert-validated').length, expertReviewRequiredCount: results.filter(item => item.verdict === 'expert-review-required').length, rejectedCount: results.filter(item => item.verdict === 'rejected').length, candidatesRegenerated: 0, draftsPromoted: 0, mongoReads: 0, mongoWrites: 0, productionWrites: 0, resultDigest: digest(results) };
  const artifact = writeRunArtifact({ summary, results });
  console.log(JSON.stringify({ ...summary, output: artifact }, null, 2));
  if (summary.expertReviewRequiredCount > 0) process.exitCode = 1;
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 15; }
