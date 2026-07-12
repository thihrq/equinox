import { execFileSync } from 'child_process';
import { resolveDataMode } from '../../config/dataMode';
import { buildAuditRuntimeReport } from './DataAuditRuntime';

export interface AuditRunContext {
  runId: string;
  startedAt: string;
  command: string;
  dataMode: 'filesystem' | 'mongo' | 'shadow';
  nodeEnv: string;
  gitCommit: string;
  gitDirty: boolean;
  mongo: {
    connected: boolean;
    reads: number;
    writes: number;
  };
}

function safeGitCommand(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function createAuditRunContext(command: string): AuditRunContext {
  const startedAt = new Date().toISOString();
  const gitCommit = safeGitCommand(['rev-parse', '--short', 'HEAD']);
  const gitStatus = safeGitCommand(['status', '--porcelain']);
  const runtime = buildAuditRuntimeReport();

  return {
    runId: `audit-${startedAt.replace(/[:.]/g, '-')}`,
    startedAt,
    command,
    dataMode: resolveDataMode(),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    gitCommit,
    gitDirty: gitStatus.length > 0,
    mongo: runtime.mongo,
  };
}
