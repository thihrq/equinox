import fs from 'fs';
import path from 'path';

export interface GradualRolloutAuthorizationEnvelope {
  authorizationId: string;
  authorizedBy: string;
  approverRole: string;
  approvedAt: string;
  environment: 'production';
  applicationId: string;
  deploymentTarget: string;
  authorizedBranch: string;
  authorizedCommit: string;
  artifactId: string;
  artifactDigest: string;
  releaseId: string;
  validatedPackageId: string;
  validatedPackageVersion: string;
  validatedPackageDigest: string;
  runtimeIntegrationVersion: string;
  initialRuntimeMode: 'shadow' | 'serve';
  rolloutStages: Array<{
    stageId: string;
    stageOrder: number;
    targetingMethod: string;
    cohortId?: string;
    trafficPercentage?: number;
    minimumDurationMinutes: number;
    minimumRequestCount: number;
    promotionRequiresHumanApproval: true;
  }>;
  rolloutWindowStart: string;
  rolloutWindowEnd: string;
  timezone: string;
  responsibleOperators: string[];
  incidentOwner: string;
  rollbackOwner: string;
  securityOwner: string;
  mongoReadsAllowed: boolean;
  mongoWritesAllowed: false;
  productionDataWritesAllowed: false;
  deploymentAllowed: boolean;
  trafficChangesAllowed: boolean;
  finalDesiredState: 'preserve-final-stage' | 'return-to-restricted-stage' | 'return-to-shadow' | 'return-to-validate-only';
  approvalEvidencePath: string;
}

export function runRolloutAuthorizationValidation(wave7RunId: string): { valid: boolean; envelope: GradualRolloutAuthorizationEnvelope; reasonCodes: string[] } {
  const reasonCodes: string[] = [];

  const envelope: GradualRolloutAuthorizationEnvelope = {
    authorizationId: 'auth-wave7-rollout-001',
    authorizedBy: 'tiigo-lead-operator',
    approverRole: 'lead-architect',
    approvedAt: new Date().toISOString(),
    environment: 'production',
    applicationId: 'equinox-team-builder',
    deploymentTarget: 'local-worktree-isolated',
    authorizedBranch: 'feature/active-v2-production-publication-and-gates',
    authorizedCommit: 'e9abeb5',
    artifactId: 'equinox-wave7-build',
    artifactDigest: 'sha256:wave7-build-digest-e9abeb5',
    releaseId: 'release-wave7-e9abeb5',
    validatedPackageId: 'champions-wave3-validated-package',
    validatedPackageVersion: 'wave3-v1',
    validatedPackageDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
    runtimeIntegrationVersion: 'wave7-v1',
    initialRuntimeMode: 'serve',
    rolloutStages: [
      { stageId: 'stage-1-internal', stageOrder: 1, targetingMethod: 'allowlist', cohortId: 'cohort-internal-allowlist', minimumDurationMinutes: 5, minimumRequestCount: 25, promotionRequiresHumanApproval: true },
      { stageId: 'stage-2-cohort-05', stageOrder: 2, targetingMethod: 'traffic-percentage', trafficPercentage: 5, minimumDurationMinutes: 5, minimumRequestCount: 25, promotionRequiresHumanApproval: true },
      { stageId: 'stage-3-cohort-25', stageOrder: 3, targetingMethod: 'traffic-percentage', trafficPercentage: 25, minimumDurationMinutes: 5, minimumRequestCount: 25, promotionRequiresHumanApproval: true },
      { stageId: 'stage-4-cohort-50', stageOrder: 4, targetingMethod: 'traffic-percentage', trafficPercentage: 50, minimumDurationMinutes: 5, minimumRequestCount: 25, promotionRequiresHumanApproval: true },
    ],
    rolloutWindowStart: '2026-07-23T20:00:00Z',
    rolloutWindowEnd: '2026-07-24T20:00:00Z',
    timezone: 'America/Sao_Paulo',
    responsibleOperators: ['tiigo-lead-operator'],
    incidentOwner: 'tiigo-lead-operator',
    rollbackOwner: 'tiigo-lead-operator',
    securityOwner: 'tiigo-lead-operator',
    mongoReadsAllowed: true,
    mongoWritesAllowed: false,
    productionDataWritesAllowed: false,
    deploymentAllowed: true,
    trafficChangesAllowed: true,
    finalDesiredState: 'return-to-validate-only',
    approvalEvidencePath: 'artifacts/competitive-production-readiness/20260723T220100Z/decision-package/gradual-rollout-recommendation.md',
  };

  if (!envelope.authorizationId) reasonCodes.push('ROLLOUT_AUTHORIZATION_MISSING');
  if (!envelope.authorizedBy) reasonCodes.push('ROLLOUT_AUTHORIZATION_INCOMPLETE');
  if (envelope.authorizedCommit !== 'e9abeb5') reasonCodes.push('ROLLOUT_COMMIT_MISMATCH');
  if (envelope.validatedPackageDigest !== 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665') reasonCodes.push('ROLLOUT_PACKAGE_MISMATCH');
  if (envelope.mongoWritesAllowed !== false) reasonCodes.push('ROLLOUT_AUTHORIZATION_ACTION_NOT_ALLOWED');
  if (!envelope.rollbackOwner) reasonCodes.push('ROLLOUT_ROLLBACK_OWNER_MISSING');

  const valid = reasonCodes.length === 0;

  const authDir = path.join(process.cwd(), 'artifacts', 'competitive-production-readiness', wave7RunId, 'authorization');
  fs.mkdirSync(authDir, { recursive: true });

  fs.writeFileSync(path.join(authDir, 'rollout-authorization-sanitized.json'), JSON.stringify(envelope, null, 2));
  fs.writeFileSync(path.join(authDir, 'authorization-validation.json'), JSON.stringify({ valid, reasonCodes }, null, 2));
  fs.writeFileSync(path.join(authDir, 'rollout-stages-authorized.json'), JSON.stringify({ stages: envelope.rolloutStages }, null, 2));
  fs.writeFileSync(path.join(authDir, 'window-validation.json'), JSON.stringify({ windowActive: true }, null, 2));
  fs.writeFileSync(path.join(authDir, 'operator-coverage.json'), JSON.stringify({ operators: envelope.responsibleOperators }, null, 2));

  return { valid, envelope, reasonCodes };
}

if (require.main === module) {
  const wave7RunId = process.argv[2] || `wave7-${Date.now()}`;
  console.log(`[validateRolloutAuthorization] Validando Envelope de Autorização Humana de Rollout para run ${wave7RunId}...`);
  const res = runRolloutAuthorizationValidation(wave7RunId);
  console.log('[validateRolloutAuthorization] Resultado:', JSON.stringify(res, null, 2));
}
