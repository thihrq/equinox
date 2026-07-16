import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function checkExitCode(cmd: string, env: any, expectedCode: number): void {
  try {
    execSync(cmd, { stdio: 'ignore', env: { ...process.env, ...env } });
    if (expectedCode !== 0) {
      throw new Error(`Command "${cmd}" returned code 0 but expected ${expectedCode}`);
    }
  } catch (error: any) {
    const code = error.status;
    if (code !== expectedCode) {
      throw new Error(`Command "${cmd}" returned code ${code} but expected ${expectedCode}`);
    }
  }
}

function runCliExitCodeTests(): void {
  const tempDir = path.resolve('./temp-cli-production-test');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const validAcceptanceReport = {
    policyVersion: 'active-v2-acceptance-v1',
    inputEvidenceDigest: 'sha256-abcdef',
    inputCommitSha: 'commit-123',
    inputActiveRunId: 'run-123',
    baselineSourceDigest: 'sha256-baseline123',
    activeV2DataDigest: 'sha256-v2data123',
    activeV2RecordCount: 2,
    activeV2DataDigestAlgorithm: 'active-v2-canonical-sha256-v1',
    evidenceValid: true,
    globalBlockers: [],
    classificationCounts: { blocker: 0, regression: 0, 'human-review-needed': 0, improvement: 0, 'acceptable-divergence': 0, equivalent: 2 },
    scenarioVerdicts: [],
    gateStatus: 'approved',
    automaticRolloutApproved: true,
    generatedAt: new Date().toISOString()
  };

  const pathReport = path.join(tempDir, 'acceptance-approved.json');
  fs.writeFileSync(pathReport, JSON.stringify(validAcceptanceReport, null, 2));

  const cliPublish = 'npx ts-node src/scripts/publishActiveV2Production.ts';
  const cliRollback = 'npx ts-node src/scripts/rollbackActiveV2Production.ts';

  // --- PUBLICADOR ---
  // Asserção 1: Ausência de argumentos obrigatórios -> Exit Code 2
  checkExitCode(cliPublish, {}, 2);

  // Asserção 2: Falha de segurança por flags de ambiente dry-run incorretas -> Exit Code 2
  checkExitCode(
    `${cliPublish} --acceptance-report "${pathReport}" --publish-run-id "run-1" --dry-run`,
    { EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION: 'false', EQUINOX_ALLOW_DATABASE_WRITES: 'true' },
    2
  );

  // Asserção 3: Falha de segurança por flags de ambiente publicação real incorretas -> Exit Code 2
  checkExitCode(
    `${cliPublish} --acceptance-report "${pathReport}" --publish-run-id "run-1"`,
    { EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION: 'true', EQUINOX_ALLOW_DATABASE_WRITES: 'true', EQUINOX_ACTIVE_V2_PRODUCTION_TARGET: 'invalid' },
    2
  );

  // Asserção 4: Arquivo de aceitação inexistente -> Exit Code 3
  checkExitCode(
    `${cliPublish} --acceptance-report "${path.join(tempDir, 'does-not-exist.json')}" --publish-run-id "run-1"`,
    { EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION: 'true', EQUINOX_ALLOW_DATABASE_WRITES: 'true', EQUINOX_ACTIVE_V2_PRODUCTION_TARGET: 'pokemonsets_v2' },
    3
  );

  // Asserção 5: JSON de aceitação malformado -> Exit Code 3
  const badJsonFile = path.join(tempDir, 'bad.json');
  fs.writeFileSync(badJsonFile, '{ malformed json }');
  checkExitCode(
    `${cliPublish} --acceptance-report "${badJsonFile}" --publish-run-id "run-1"`,
    { EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_PUBLICATION: 'true', EQUINOX_ALLOW_DATABASE_WRITES: 'true', EQUINOX_ACTIVE_V2_PRODUCTION_TARGET: 'pokemonsets_v2' },
    3
  );

  // --- ROLLBACK ---
  // Asserção 6: Ausência de run-id -> Exit Code 2
  checkExitCode(cliRollback, {}, 2);

  // Asserção 7: Falha de segurança flags de ambiente dry-run rollback incorretas -> Exit Code 2
  checkExitCode(
    `${cliRollback} --run-id "run-1" --dry-run`,
    { EQUINOX_ENABLE_ACTIVE_V2_PRODUCTION_ROLLBACK: 'false' },
    2
  );

  // Cleanup
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('[Equinox] Active V2 production CLI exit code validation passed.');
}

runCliExitCodeTests();
