import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

export interface AuditedFileSource {
  path: string;
  sha256: string;
  recordCount?: number;
}

export async function calculateSha256(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex').toUpperCase();
  } catch (error) {
    throw new Error(`Unable to calculate SHA-256 for ${filePath}: ${String(error)}`);
  }
}
