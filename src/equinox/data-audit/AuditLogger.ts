import { AuditRunContext } from './AuditRunContext';
import { AuditedFileSource } from './FileIntegrity';

export interface AuditLoggerInput {
  context: AuditRunContext;
  sources?: AuditedFileSource[];
  readCount?: number;
  writtenCount?: number;
}

export function printAuditHeader(input: AuditLoggerInput): void {
  console.log(`[RUN ID] ${input.context.runId}`);
  console.log(`[COMMAND] ${input.context.command}`);
  console.log(`[DATA MODE] ${input.context.dataMode}`);
  console.log(`[NODE ENV] ${input.context.nodeEnv}`);
  console.log(`[GIT COMMIT] ${input.context.gitCommit}`);
  console.log(`[GIT DIRTY] ${input.context.gitDirty}`);
  console.log(`[MONGO CONNECTED] ${input.context.mongo.connected}`);
  console.log(`[MONGO READS] ${input.context.mongo.reads}`);
  console.log(`[MONGO WRITES] ${input.context.mongo.writes}`);

  for (const source of input.sources ?? []) {
    console.log(`[SOURCE] ${source.path}`);
    console.log(`[SHA256] ${source.sha256}`);
    if (typeof source.recordCount === 'number') console.log(`[READ COUNT] ${source.recordCount}`);
  }

  if (typeof input.readCount === 'number') console.log(`[READ COUNT] ${input.readCount}`);
  if (typeof input.writtenCount === 'number') console.log(`[WRITTEN COUNT] ${input.writtenCount}`);
}
