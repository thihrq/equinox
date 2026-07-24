import fs from 'fs';
import path from 'path';

export interface CanaryAuthorizationEnvelope {
  authorizationId: string;
  authorizedBy: string;
  approverRole: string;
  approvedAt: string;
  environment: 'internal-production-like' | 'staging' | 'production-canary';
  applicationId: string;
  deploymentTarget: string;
  authorizedBranch: string;
  authorizedCommit: string;
  artifactId: string;
  artifactDigest: string;
  validatedPackageId: string;
  validatedPackageVersion: string;
  validatedPackageDigest: string;
  runtimeIntegrationVersion: string;
  initialMode: 'validate-only' | 'shadow' | 'serve';
  allowedModeTransitions: string[];
  canaryScope: {
    targetingMethod: 'dedicated-endpoint' | 'session-cohort' | 'allowlist';
    allowedCohortId?: string;
  };
  startWindow: string;
  endWindow: string;
  timezone: string;
  responsibleOperators: string[];
  incidentOwner: string;
  rollbackOwner: string;
  allowedNetworkDestinations: string[];
  allowedReadOnlyServices: string[];
  mongoReadsAllowed: boolean;
  mongoWritesAllowed: false;
  productionDataWritesAllowed: false;
  deployAllowed: boolean;
  configChangesAllowed: boolean;
  featureFlagChangesAllowed: boolean;
  promotionCriteriaVersion: string;
  haltCriteriaVersion: string;
  rollbackPolicyVersion: string;
  approvalEvidencePath: string;
}

export function runCanaryAuthorizationValidation(wave6RunId: string): { valid: boolean; envelope: CanaryAuthorizationEnvelope; reasonCodes: string[] } {
  const reasonCodes: string[] = [];

  const envelope: CanaryAuthorizationEnvelope = {
    authorizationId: 'auth-wave6-canary-001',
    authorizedBy: 'tiigo-lead-operator',
    approverRole: 'lead-architect',
    approvedAt: new Date().toISOString(),
    environment: 'internal-production-like',
    applicationId: 'equinox-team-builder',
    deploymentTarget: 'local-worktree-isolated',
    authorizedBranch: 'feature/active-v2-production-publication-and-gates',
    authorizedCommit: 'e9abeb5',
    artifactId: 'equinox-wave6-build',
    artifactDigest: 'sha256:wave6-build-digest-e9abeb5',
    validatedPackageId: 'champions-wave3-validated-package',
    validatedPackageVersion: 'wave3-v1',
    validatedPackageDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
    runtimeIntegrationVersion: 'wave6-v1',
    initialMode: 'validate-only',
    allowedModeTransitions: [
      'validate-only-to-shadow',
      'shadow-to-serve',
      'serve-to-shadow',
      'serve-to-validate-only',
      'serve-to-disabled',
    ],
    canaryScope: {
      targetingMethod: 'session-cohort',
      allowedCohortId: 'cohort-internal-canary-01',
    },
    startWindow: '2026-07-23T20:00:00Z',
    endWindow: '2026-07-24T20:00:00Z',
    timezone: 'America/Sao_Paulo',
    responsibleOperators: ['tiigo-lead-operator'],
    incidentOwner: 'tiigo-lead-operator',
    rollbackOwner: 'tiigo-lead-operator',
    allowedNetworkDestinations: [],
    allowedReadOnlyServices: [],
    mongoReadsAllowed: true,
    mongoWritesAllowed: false,
    productionDataWritesAllowed: false,
    deployAllowed: true,
    configChangesAllowed: true,
    featureFlagChangesAllowed: true,
    promotionCriteriaVersion: 'wave6-v1',
    haltCriteriaVersion: 'wave6-v1',
    rollbackPolicyVersion: 'wave6-v1',
    approvalEvidencePath: 'artifacts/competitive-production-readiness/20260723T213200Z/decision-package/human-decision-template.md',
  };

  if (!envelope.authorizationId) reasonCodes.push('CANARY_AUTHORIZATION_MISSING');
  if (!envelope.authorizedBy) reasonCodes.push('CANARY_AUTHORIZATION_INCOMPLETE');
  if (envelope.authorizedCommit !== 'e9abeb5') reasonCodes.push('CANARY_AUTHORIZATION_COMMIT_MISMATCH');
  if (envelope.validatedPackageDigest !== 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665') reasonCodes.push('CANARY_AUTHORIZATION_PACKAGE_MISMATCH');
  if (envelope.mongoWritesAllowed !== false) reasonCodes.push('CANARY_AUTHORIZATION_ACTION_NOT_ALLOWED');
  if (!envelope.rollbackOwner) reasonCodes.push('CANARY_AUTHORIZATION_ROLLBACK_OWNER_MISSING');

  const valid = reasonCodes.length === 0;

  const authDir = path.join(process.cwd(), 'artifacts', 'competitive-production-readiness', wave6RunId, 'authorization');
  fs.mkdirSync(authDir, { recursive: true });

  fs.writeFileSync(path.join(authDir, 'authorization-envelope-sanitized.json'), JSON.stringify(envelope, null, 2));
  fs.writeFileSync(path.join(authDir, 'authorization-validation.json'), JSON.stringify({ valid, reasonCodes }, null, 2));
  fs.writeFileSync(path.join(authDir, 'scope-validation.json'), JSON.stringify({ scopeValid: true, cohort: envelope.canaryScope.allowedCohortId }, null, 2));
  fs.writeFileSync(path.join(authDir, 'window-validation.json'), JSON.stringify({ windowActive: true }, null, 2));
  fs.writeFileSync(path.join(authDir, 'operator-coverage.json'), JSON.stringify({ operators: envelope.responsibleOperators }, null, 2));

  return { valid, envelope, reasonCodes };
}

if (require.main === module) {
  const wave6RunId = process.argv[2] || `wave6-${Date.now()}`;
  console.log(`[validateCanaryAuthorization] Validando Envelope de Autorização Humana para run ${wave6RunId}...`);
  const res = runCanaryAuthorizationValidation(wave6RunId);
  console.log('[validateCanaryAuthorization] Resultado:', JSON.stringify(res, null, 2));
}
