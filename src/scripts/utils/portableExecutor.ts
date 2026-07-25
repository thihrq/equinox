import { spawnSync, SpawnSyncOptions } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

export function resolveNpmExecutable(overridePlatform?: string): string {
  const platform = overridePlatform || os.platform();
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function resolveNpxExecutable(overridePlatform?: string): string {
  const platform = overridePlatform || os.platform();
  return platform === 'win32' ? 'npx.cmd' : 'npx';
}

export interface SpawnPackageResult {
  command: string;
  args: string[];
  status: number | null;
  stdout: string;
  stderr: string;
}

export function spawnPackageCommand(
  binType: 'npm' | 'npx' | string,
  args: string[],
  options?: SpawnSyncOptions
): SpawnPackageResult {
  let executable = binType;

  if (binType === 'npm') {
    executable = resolveNpmExecutable();
  } else if (binType === 'npx') {
    executable = resolveNpxExecutable();
  }

  const result = spawnSync(executable, args, {
    encoding: 'utf-8',
    shell: true,
    ...options,
  });

  return {
    command: executable,
    args,
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

export function runPortableExecutorAudit(wave4RunId: string) {
  const winNpm = resolveNpmExecutable('win32');
  const linuxNpm = resolveNpmExecutable('linux');
  const winNpx = resolveNpxExecutable('win32');
  const linuxNpx = resolveNpxExecutable('linux');

  const windowsResolution = winNpm === 'npm.cmd' && winNpx === 'npx.cmd' ? 'PASS' : 'FAIL';
  const linuxResolution = linuxNpm === 'npm' && linuxNpx === 'npx' ? 'PASS' : 'FAIL';

  const auditResult = {
    windowsCommandResolution: windowsResolution,
    linuxCommandResolution: linuxResolution,
    winNpm,
    linuxNpm,
    winNpx,
    linuxNpx,
    timestamp: new Date().toISOString(),
  };

  const outputDir = path.join(
    process.cwd(),
    'artifacts',
    'competitive-production-readiness',
    wave4RunId,
    'cross-platform'
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'command-audit.json'),
    JSON.stringify(auditResult, null, 2)
  );

  return auditResult;
}

if (require.main === module) {
  const wave4RunId = process.argv[2] || `wave4-${Date.now()}`;
  console.log(`[PortableExecutor] Executando auditoria multiplataforma para run ${wave4RunId}...`);
  const result = runPortableExecutorAudit(wave4RunId);
  console.log('[PortableExecutor] Resultado:', JSON.stringify(result, null, 2));
}
