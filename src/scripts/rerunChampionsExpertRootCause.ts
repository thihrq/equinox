import fs from 'fs';
import path from 'path';
import { classifyStage4ReasonCode, Stage4RootCauseCategory } from '../services/competitive-data/expert/Stage4RootCauseAudit';

declare const process: { exitCode?: number };
const file = path.resolve('artifacts/competitive-expert/champions-candidate-evidence-champions-candidate-evidence-v1/expert-rerun-results.json');
try {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as { results: Array<{ verdict: string; reasonCodes: string[] }> };
  const categories: Stage4RootCauseCategory[] = ['engine-coverage-gap', 'evidence-generation-gap', 'policy-threshold', 'real-strategic-uncertainty', 'meta-dependent', 'battle-test-dependent', 'data-quality-problem', 'implementation-defect'];
  const summary = Object.fromEntries(categories.map(category => [category, payload.results.filter(result => result.verdict === 'expert-review-required' && result.reasonCodes.some(code => classifyStage4ReasonCode(code) === category)).length]));
  console.log(JSON.stringify({ valid: true, candidateCount: payload.results.length, ...summary, expertValidatedCount: payload.results.filter(result => result.verdict === 'expert-validated').length, expertReviewRequiredCount: payload.results.filter(result => result.verdict === 'expert-review-required').length, rejectedCount: payload.results.filter(result => result.verdict === 'rejected').length }, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 16; }
