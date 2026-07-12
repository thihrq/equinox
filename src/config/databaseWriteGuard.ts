import { resolveDataMode } from './dataMode';

export interface DatabaseWriteContext {
  operation: string;
  collection?: string;
  recordCount?: number;
}

export function assertDatabaseWritesAllowed(context: DatabaseWriteContext): void {
  const dataMode = resolveDataMode();
  const writesAllowed = process.env.EQUINOX_ALLOW_DATABASE_WRITES === 'true';

  if (dataMode === 'filesystem' || dataMode === 'shadow') {
    throw new Error(`Database write blocked in ${dataMode} mode: ${context.operation}`);
  }

  if (!writesAllowed) {
    throw new Error(
      `Database write blocked: ${context.operation}. Set EQUINOX_ALLOW_DATABASE_WRITES=true explicitly.`,
    );
  }
}
