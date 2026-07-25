import fs from 'fs';
import path from 'path';
import { digest } from '../CompetitiveCurationCore';
import { CurationSetDraft, MatchupScenario, FullTeamEvaluation } from '../CompetitiveCurationTypes';
import { auditAgentIndependence } from './ChampionsAgentIndependenceAudit';
import { ADVERSARIAL_POLICY_VERSION } from './ChampionsAdversarialAuditPolicy';
import { createAdversarialFixtures, loadPositiveCandidate } from './ChampionsAdversarialFixtureFactory';
import { ChampionsAdversarialAuditRunManifest, AdversarialCaseResult } from './ChampionsAdversarialAuditTypes';
import { validateAdversarialMatrix, evaluateAdversarialCase } from './ChampionsAdversarialResultValidator';
import { auditThresholds } from './ChampionsThresholdAudit';
import { auditScenarios } from './ChampionsScenarioAudit';
import { auditFullTeams } from './ChampionsFullTeamAudit';
import { auditPromotionGuards } from './ChampionsPromotionGuardAudit';

export function writeJson(filePath: string, value: unknown): void { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export function assertAdversarialFlags(env: Record<string, string | undefined> = process.env): void {
  if (env.EQUINOX_ENABLE_CHAMPIONS_ADVERSARIAL_AUDIT !== 'true') throw new Error('CHAMPIONS_ADVERSARIAL_AUDIT_DISABLED');
  if (env.EQUINOX_CHAMPIONS_ADVERSARIAL_AUDIT_ONLY !== 'true') throw new Error('CHAMPIONS_ADVERSARIAL_AUDIT_MODE_REQUIRED');
  if (env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS === 'true') throw new Error('CHAMPIONS_NETWORK_READS_MUST_BE_DISABLED');
  if (env.EQUINOX_ALLOW_DATABASE_WRITES === 'true') throw new Error('CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
  if (env.EQUINOX_CHAMPIONS_REGULATION_ID !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
}
export function runAdversarialAudit(curationRunId: string, auditRunId: string): { root: string; results: AdversarialCaseResult[]; errors: string[] } {
  const sourceRoot = path.resolve('artifacts/champions-curation/mb', curationRunId);
  if (!fs.existsSync(path.join(sourceRoot, 'drafts.json'))) throw new Error('CHAMPIONS_SENTINEL_ARTIFACTS_MISSING');
  const selection = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'selection.json'), 'utf8')) as { packageDigest: string; selectedPokemonIds: string[] };
  const drafts = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'drafts.json'), 'utf8')) as CurationSetDraft[];
  if (selection.selectedPokemonIds.length !== 10 || drafts.length !== 20) throw new Error('CHAMPIONS_SENTINEL_ARTIFACTS_INVALID');
  const fixtures = createAdversarialFixtures(curationRunId);
  const results = fixtures.map(evaluateAdversarialCase);
  const errors = validateAdversarialMatrix(results);
  const root = path.resolve('artifacts/competitive-curation', curationRunId, 'adversarial-audit');
  const realScenarios = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'matchups.json'), 'utf8')) as MatchupScenario[];
  const realTeams = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'full-team.json'), 'utf8')) as FullTeamEvaluation[];
  const positive = loadPositiveCandidate(curationRunId);
  const independence = auditAgentIndependence(positive);
  const thresholds = auditThresholds();
  const scenarioAudit = auditScenarios(realScenarios, selection.selectedPokemonIds);
  const fullTeamAudit = auditFullTeams(realTeams);
  const promotionGuard = auditPromotionGuards(curationRunId);
  writeJson(path.join(root, 'adversarial-fixtures.json'), fixtures);
  writeJson(path.join(root, 'adversarial-results.json'), results);
  writeJson(path.join(root, 'adversarial-matrix.json'), results);
  writeJson(path.join(root, 'agent-independence-audit.json'), independence);
  writeJson(path.join(root, 'threshold-audit.json'), thresholds);
  writeJson(path.join(root, 'scenario-audit.json'), scenarioAudit);
  writeJson(path.join(root, 'full-team-audit.json'), fullTeamAudit);
  writeJson(path.join(root, 'promotion-guard-audit.json'), promotionGuard);
  writeJson(path.join(root, 'reports/adversarial-rejected-cases.json'), results.filter(result => result.actualVerdict === 'rejected'));
  writeJson(path.join(root, 'reports/adversarial-human-review-cases.json'), results.filter(result => result.actualVerdict === 'human-review-required'));
  writeJson(path.join(root, 'reports/adversarial-positive-control.json'), results.find(result => result.caseId === 'adversarial-76'));
  writeJson(path.join(root, 'reports/sentinel-quality-findings.json'), { scenarioAudit, fullTeamAudit, thresholds, independence });
  const manifest: ChampionsAdversarialAuditRunManifest = { auditRunId, sourceCurationRunId: curationRunId, regulationId: 'M-B', packageDigest: selection.packageDigest, rosterDigest: digest(selection.selectedPokemonIds), mechanicsDigest: selection.packageDigest, adversarialPolicyVersion: ADVERSARIAL_POLICY_VERSION, curationPolicyVersion: 'champions-mb-sentinel-curation-v1', fixtureCount: fixtures.length, rejectedExpected: fixtures.filter(item => item.expectedVerdict === 'rejected').length, humanReviewExpected: fixtures.filter(item => item.expectedVerdict === 'human-review-required').length, agentReviewedExpected: fixtures.filter(item => item.expectedVerdict === 'agent-reviewed').length, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), mongoReads: 0, mongoWrites: 0, productionWrites: 0, artifactsDigest: digest({ results, independence, thresholds, scenarioAudit, fullTeamAudit, promotionGuard }) };
  writeJson(path.join(root, 'adversarial-run-manifest.json'), manifest);
  const summary = { auditRunId, sourceCurationRunId: curationRunId, fixtureCount: fixtures.length, expected: { rejected: manifest.rejectedExpected, humanReviewRequired: manifest.humanReviewExpected, agentReviewed: manifest.agentReviewedExpected }, actual: { rejected: results.filter(result => result.actualVerdict === 'rejected').length, humanReviewRequired: results.filter(result => result.actualVerdict === 'human-review-required').length, agentReviewed: results.filter(result => result.actualVerdict === 'agent-reviewed').length }, criticalErrors: errors, independencePassed: independence.passed, thresholdsPassed: thresholds.blockersOverrideScores && thresholds.evidenceRequirementsEnforced && thresholds.humanReviewReachable, scenariosPassed: scenarioAudit.valid, fullTeamPassed: fullTeamAudit.valid, promotionGuardPassed: promotionGuard.valid, mongoReads: 0, mongoWrites: 0, productionWrites: 0 };
  writeJson(path.join(root, 'adversarial-summary.json'), summary);
  return { root, results, errors: [...errors, ...(scenarioAudit.valid ? [] : scenarioAudit.findings), ...(fullTeamAudit.valid ? [] : fullTeamAudit.findings)] };
}
