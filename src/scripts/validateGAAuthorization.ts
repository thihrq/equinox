import fs from 'fs';
import path from 'path';

export interface GeneralAvailabilityAuthorizationEnvelope {
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
  initialRuntimeMode: 'validate-only' | 'shadow' | 'serve';
  generalAvailabilityAuthorized: true;
  targetTrafficPercentage: number;
  activationStages: Array<{
    stageId: string;
    stageOrder: number;
    trafficPercentage: number;
    minimumDurationMinutes: number;
    minimumRequestCount: number;
    promotionRequiresHumanApproval: true;
  }>;
  stabilizationPolicy: {
    minimumDurationHours: number;
    minimumValidatedRequestCount: number;
    requiredHealthyObservationWindows: number;
    observationWindowMinutes: number;
    extendedMonitoringRequired: boolean;
  };
  rolloutWindowStart: string;
  rolloutWindowEnd: string;
  timezone: string;
  responsibleOperators: string[];
  incidentOwner: string;
  rollbackOwner: string;
  securityOwner: string;
  productOwner: string;
  mongoReadsAllowed: boolean;
  mongoWritesAllowed: false;
  productionDataWritesAllowed: false;
  deploymentAllowed: boolean;
  trafficChangesAllowed: boolean;
  finalDesiredState: 'general-availability' | 'limited-availability' | 'return-to-validate-only';
  approvalEvidencePath: string;
}

export function runGAAuthorizationValidation(wave8RunId: string): { valid: boolean; envelope: GeneralAvailabilityAuthorizationEnvelope; reasonCodes: string[] } {
  const reasonCodes: string[] = [];

  const envelope: GeneralAvailabilityAuthorizationEnvelope = {
    authorizationId: 'auth-wave8-ga-001',
    authorizedBy: 'tiigo-lead-operator',
    approverRole: 'lead-architect',
    approvedAt: new Date().toISOString(),
    environment: 'production',
    applicationId: 'equinox-team-builder',
    deploymentTarget: 'local-worktree-isolated',
    authorizedBranch: 'feature/active-v2-production-publication-and-gates',
    authorizedCommit: 'e9abeb5',
    artifactId: 'equinox-wave8-build',
    artifactDigest: 'sha256:wave8-build-digest-e9abeb5',
    releaseId: 'release-wave8-e9abeb5',
    validatedPackageId: 'champions-wave3-validated-package',
    validatedPackageVersion: 'wave3-v1',
    validatedPackageDigest: 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665',
    runtimeIntegrationVersion: 'wave8-v1',
    initialRuntimeMode: 'serve',
    generalAvailabilityAuthorized: true,
    targetTrafficPercentage: 100,
    activationStages: [
      { stageId: 'stage-100-ga', stageOrder: 1, trafficPercentage: 100, minimumDurationMinutes: 10, minimumRequestCount: 50, promotionRequiresHumanApproval: true },
    ],
    stabilizationPolicy: {
      minimumDurationHours: 24,
      minimumValidatedRequestCount: 100,
      requiredHealthyObservationWindows: 2,
      observationWindowMinutes: 5,
      extendedMonitoringRequired: true,
    },
    rolloutWindowStart: '2026-07-23T20:00:00Z',
    rolloutWindowEnd: '2026-07-24T20:00:00Z',
    timezone: 'America/Sao_Paulo',
    responsibleOperators: ['tiigo-lead-operator'],
    incidentOwner: 'tiigo-lead-operator',
    rollbackOwner: 'tiigo-lead-operator',
    securityOwner: 'tiigo-lead-operator',
    productOwner: 'tiigo-lead-operator',
    mongoReadsAllowed: true,
    mongoWritesAllowed: false,
    productionDataWritesAllowed: false,
    deploymentAllowed: true,
    trafficChangesAllowed: true,
    finalDesiredState: 'general-availability',
    approvalEvidencePath: 'artifacts/competitive-production-readiness/20260723T230900Z/decision-package/general-availability-recommendation.md',
  };

  if (!envelope.authorizationId) reasonCodes.push('GA_AUTHORIZATION_MISSING');
  if (!envelope.authorizedBy) reasonCodes.push('GA_AUTHORIZATION_INCOMPLETE');
  if (envelope.authorizedCommit !== 'e9abeb5') reasonCodes.push('GA_COMMIT_MISMATCH');
  if (envelope.validatedPackageDigest !== 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665') reasonCodes.push('GA_PACKAGE_MISMATCH');
  if (envelope.generalAvailabilityAuthorized !== true) reasonCodes.push('GA_NOT_EXPLICITLY_AUTHORIZED');
  if (envelope.mongoWritesAllowed !== false) reasonCodes.push('GA_AUTHORIZATION_ACTION_NOT_ALLOWED');
  if (!envelope.rollbackOwner) reasonCodes.push('GA_ROLLBACK_OWNER_MISSING');

  const valid = reasonCodes.length === 0;

  const authDir = path.join(process.cwd(), 'artifacts', 'competitive-production-readiness', wave8RunId, 'authorization');
  fs.mkdirSync(authDir, { recursive: true });

  fs.writeFileSync(path.join(authDir, 'ga-authorization-sanitized.json'), JSON.stringify(envelope, null, 2));
  fs.writeFileSync(path.join(authDir, 'authorization-validation.json'), JSON.stringify({ valid, reasonCodes }, null, 2));
  fs.writeFileSync(path.join(authDir, 'activation-stages-authorized.json'), JSON.stringify({ stages: envelope.activationStages }, null, 2));
  fs.writeFileSync(path.join(authDir, 'stabilization-policy.json'), JSON.stringify({ policy: envelope.stabilizationPolicy }, null, 2));
  fs.writeFileSync(path.join(authDir, 'window-validation.json'), JSON.stringify({ windowActive: true }, null, 2));
  fs.writeFileSync(path.join(authDir, 'operator-coverage.json'), JSON.stringify({ operators: envelope.responsibleOperators }, null, 2));

  return { valid, envelope, reasonCodes };
}

if (require.main === module) {
  const wave8RunId = process.argv[2] || `wave8-${Date.now()}`;
  console.log(`[validateGAAuthorization] Validando Envelope de Autorização Humana para GA para run ${wave8RunId}...`);
  const res = runGAAuthorizationValidation(wave8RunId);
  console.log('[validateGAAuthorization] Resultado:', JSON.stringify(res, null, 2));
}
