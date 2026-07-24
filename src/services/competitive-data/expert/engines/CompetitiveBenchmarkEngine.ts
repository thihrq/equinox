import crypto from 'crypto';
import { ExpertEvidence, ExpertFinding } from '../CompetitiveDoublesExpertTypes';
import { BenchmarkCandidate, BenchmarkClassification, CompetitiveBenchmarkInput, CompetitiveBenchmarkResult } from './CompetitiveBenchmarkTypes';

export const BENCHMARK_ENGINE_VERSION = 'competitive-benchmark-engine-v1';
export const BENCHMARK_POLICY_VERSION = 'competitive-benchmark-v1';

function digest(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function finding(code: string, message: string, blocking: boolean): ExpertFinding {
  return { code, message, severity: blocking ? 'error' : 'warning', blocking, evidenceIds: [] };
}

function equalDimensions(first: BenchmarkCandidate, second: BenchmarkCandidate): boolean {
  return Object.keys(first.dimensions).every(key => first.dimensions[key as keyof typeof first.dimensions] === second.dimensions[key as keyof typeof second.dimensions]);
}

function classify(candidate: BenchmarkCandidate, alternative: BenchmarkCandidate): BenchmarkClassification {
  if (alternative.creative && alternative.evidenceIds.length === 0) return 'creative-but-unproven';
  const keys = Object.keys(candidate.dimensions) as Array<keyof typeof candidate.dimensions>;
  const allAtLeast = keys.every(key => alternative.dimensions[key] >= candidate.dimensions[key]);
  const allBelow = keys.every(key => alternative.dimensions[key] < candidate.dimensions[key]);
  const hasBetter = keys.some(key => alternative.dimensions[key] > candidate.dimensions[key]);
  const hasWorse = keys.some(key => alternative.dimensions[key] < candidate.dimensions[key]);
  if (allAtLeast && hasBetter) return 'dominated';
  if (allBelow) return 'strictly-inferior';
  if (hasBetter && hasWorse) return 'inferior-in-one-dimension';
  return 'different';
}

export function benchmarkCandidate(input: CompetitiveBenchmarkInput): CompetitiveBenchmarkResult {
  const findings: ExpertFinding[] = [];
  if (!input.candidate.legal) findings.push(finding('CANDIDATE_ILLEGAL', 'benchmark candidate is illegal', true));
  if (input.maxAlternativesPerCandidate < 1 || input.comparisonLimit < 1) findings.push(finding('BENCHMARK_LIMIT_INVALID', 'benchmark limits must be positive', true));
  if (input.candidate.evidenceIds.length === 0) findings.push(finding('BENCHMARK_EVIDENCE_REQUIRED', 'candidate has no evidence references', false));
  const comparisons: CompetitiveBenchmarkResult['comparisons'] = [];
  const comparedAlternativeIds: string[] = [];
  const limit = Math.min(input.maxAlternativesPerCandidate, input.comparisonLimit);
  for (const alternative of input.alternativeCandidates) {
    if (comparedAlternativeIds.length >= limit) break;
    if (!alternative.legal) continue;
    if (equalDimensions(input.candidate, alternative)) continue;
    const warnings: string[] = [];
    if (alternative.evidenceIds.length === 0) {
      findings.push(finding('BENCHMARK_EVIDENCE_REQUIRED', `alternative ${alternative.candidateId} has no evidence references`, false));
      warnings.push('evidence-required');
    }
    const classification = classify(input.candidate, alternative);
    comparisons.push({ candidateId: alternative.candidateId, classification, warnings });
    comparedAlternativeIds.push(alternative.candidateId);
  }
  const resultWithoutDigest = {
    componentId: `${BENCHMARK_ENGINE_VERSION}:${input.candidate.candidateId}`,
    valid: findings.every(item => !item.blocking),
    findings,
    evidence: [] as ExpertEvidence[],
    execution: { executed: true, executionReason: 'engine-executed' as const },
    candidateId: input.candidate.candidateId,
    comparedAlternativeIds,
    dimensions: input.candidate.dimensions,
    dominated: comparisons.some(item => item.classification === 'dominated'),
    assumptions: [`comparison limited to ${limit} legal, non-identical alternatives`, 'dimension scores are supplied evidence, not inferred from network or production state'],
    comparisons,
    unsupportedMechanics: [],
  };
  const resultDigest = digest(resultWithoutDigest);
  const evidence: ExpertEvidence[] = [{ evidenceId: `${resultWithoutDigest.componentId}:benchmark`, kind: 'benchmark', sourceId: 'equinox-competitive-benchmark-engine', sourceRevision: BENCHMARK_ENGINE_VERSION, inputDigest: digest(input), resultDigest, description: 'Bounded comparison of legal, non-identical alternatives with explicit classification and evidence warnings.' }];
  return { ...resultWithoutDigest, evidence, resultDigest, inputDigest: digest(input) };
}
