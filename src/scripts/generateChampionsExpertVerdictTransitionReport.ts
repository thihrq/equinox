import fs from 'fs';
import path from 'path';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}
function readJson<T>(file: string): T { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as T; }

interface SpecialistResultLite { specialistId: string; confidence: string }
interface FindingLite { code: string; materiality?: string }
interface ResultLite { candidateId: string; verdict: string; confidence: string; reasonCodes: string[]; specialistResults: SpecialistResultLite[]; materialFindings?: FindingLite[]; aggregationPolicyId?: string; aggregationPolicyVersion?: string }
interface RunFile { summary: unknown; results: ResultLite[] }

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir', '--previous-file', '--updated-file']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId}/reevaluation`;
  const previousFile = arg('--previous-file');
  const updatedFile = arg('--updated-file');
  if (!previousFile || !updatedFile) fail('--previous-file and --updated-file are required', 2);
  if (!fs.existsSync(previousFile)) fail(`Previous file missing: ${previousFile}`, 3);
  if (!fs.existsSync(updatedFile)) fail(`Updated file missing: ${updatedFile}`, 3);

  const previous = readJson<RunFile>(previousFile);
  const updated = readJson<RunFile>(updatedFile);
  const previousById = new Map(previous.results.map(result => [result.candidateId, result]));
  const updatedById = new Map(updated.results.map(result => [result.candidateId, result]));
  if (previousById.size !== 20 || updatedById.size !== 20) fail(`Expected 20 candidates in both files, got ${previousById.size}/${updatedById.size}`, 3);

  const verdictTransitions = [...updatedById.keys()].map(candidateId => {
    const prev = previousById.get(candidateId)!;
    const next = updatedById.get(candidateId)!;
    return {
      candidateId,
      previousVerdict: prev.verdict, previousConfidence: prev.confidence,
      newVerdict: next.verdict, newConfidence: next.confidence,
      verdictChanged: prev.verdict !== next.verdict, confidenceChanged: prev.confidence !== next.confidence,
      materialFindings: next.materialFindings ?? [],
      reasonCodes: next.reasonCodes,
      policyVersion: next.aggregationPolicyVersion ?? 'unknown',
    };
  });

  const confidenceTransitions = verdictTransitions.map(item => ({
    candidateId: item.candidateId, previousConfidence: item.previousConfidence, newConfidence: item.newConfidence, changed: item.confidenceChanged,
  }));

  const criticalReviewImpact = [...updatedById.keys()].map(candidateId => {
    const next = updatedById.get(candidateId)!;
    const criticalReviewResult = next.specialistResults.find(result => result.specialistId === 'critical-review');
    const criticalReviewMaterialFindings = (next.materialFindings ?? []).filter(finding => finding.code.startsWith('EXPERT_CRITICAL_'));
    return {
      candidateId,
      criticalReviewConfidence: criticalReviewResult?.confidence ?? 'unknown',
      criticalReviewMaterialFindingCount: criticalReviewMaterialFindings.length,
      criticalReviewMaterialFindings: criticalReviewMaterialFindings.map(finding => finding.code),
      verdictInfluencedByCriticalReview: criticalReviewMaterialFindings.length > 0,
    };
  });

  const summary = {
    runId,
    candidateCount: verdictTransitions.length,
    verdictChangedCount: verdictTransitions.filter(item => item.verdictChanged).length,
    confidenceChangedCount: verdictTransitions.filter(item => item.confidenceChanged).length,
    candidatesWithCriticalReviewImpact: criticalReviewImpact.filter(item => item.verdictInfluencedByCriticalReview).length,
    previousVerdictDistribution: previous.summary,
    updatedVerdictDistribution: updated.summary,
    mongoReads: 0, mongoWrites: 0, productionWrites: 0,
  };

  writeAtomic(path.resolve(outputDir, 'previous-verdicts.json'), previous);
  writeAtomic(path.resolve(outputDir, 'updated-verdicts.json'), updated);
  writeAtomic(path.resolve(outputDir, 'verdict-transition-report.json'), { runId, transitions: verdictTransitions, summary });
  writeAtomic(path.resolve(outputDir, 'confidence-transition-report.json'), { runId, transitions: confidenceTransitions, changedCount: summary.confidenceChangedCount });
  writeAtomic(path.resolve(outputDir, 'critical-review-impact-report.json'), { runId, impact: criticalReviewImpact, candidatesWithCriticalReviewImpact: summary.candidatesWithCriticalReviewImpact });

  console.log(JSON.stringify({ valid: true, ...summary }));
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
