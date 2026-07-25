import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface PreflightResult {
  passed: boolean;
  worktreePath: string;
  branch: string;
  head: string;
  packageDigest: string;
  reasonCodes: string[];
}

export function runWorktreePreflight(wave4RunId: string): PreflightResult {
  const reasonCodes: string[] = [];
  let passed = true;

  const cwd = process.cwd();
  const normalizedCwd = cwd.replace(/\\/g, '/');

  if (!normalizedCwd.includes('competitive-data-v2-clean')) {
    reasonCodes.push('WRONG_WORKTREE_SELECTED');
    passed = false;
  }

  let branch = '';
  let head = '';

  try {
    branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    head = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (err) {
    reasonCodes.push('EXPECTED_WORKTREE_NOT_FOUND');
    passed = false;
  }

  if (branch && branch !== 'feature/active-v2-production-publication-and-gates') {
    reasonCodes.push('BRANCH_MISMATCH');
  }

  if (head && head !== 'e9abeb5') {
    reasonCodes.push('HEAD_CHANGED_REVIEW_REQUIRED');
  }

  const wave3ManifestPath = path.join(
    cwd,
    'artifacts',
    'competitive-production-readiness',
    '20260720T231346Z',
    'validated-package',
    'manifest.json'
  );

  let packageDigest = '';

  if (!fs.existsSync(wave3ManifestPath)) {
    reasonCodes.push('WAVE3_ARTIFACTS_NOT_FOUND');
    passed = false;
  } else {
    try {
      const manifestData = JSON.parse(fs.readFileSync(wave3ManifestPath, 'utf-8'));
      packageDigest = manifestData.packageDigest || '';
      const expectedDigest = 'sha256:797874d721cd72f361a2cf0085ec4199bdafd00825f58a66ac247bcc442ed665';

      if (packageDigest !== expectedDigest) {
        reasonCodes.push('WAVE3_PACKAGE_DIGEST_MISMATCH');
        passed = false;
      }
    } catch {
      reasonCodes.push('WAVE3_ARTIFACTS_NOT_FOUND');
      passed = false;
    }
  }

  const outputDir = path.join(
    cwd,
    'artifacts',
    'competitive-production-readiness',
    wave4RunId,
    'baseline'
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'worktree-preflight.json'),
    JSON.stringify(
      {
        passed,
        worktreePath: cwd,
        branch,
        head,
        packageDigest,
        reasonCodes,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  return { passed, worktreePath: cwd, branch, head, packageDigest, reasonCodes };
}

if (require.main === module) {
  const wave4RunId = process.argv[2] || `wave4-${Date.now()}`;
  console.log(`[Preflight] Executando preflight de identidade no worktree para run ${wave4RunId}...`);
  const result = runWorktreePreflight(wave4RunId);
  console.log('[Preflight] Resultado:', JSON.stringify(result, null, 2));

  if (!result.passed) {
    console.error('[Preflight] FALHA DE PRÉ-REQUISITO DE WORKTREE:', result.reasonCodes.join(', '));
    process.exit(1);
  }
}
