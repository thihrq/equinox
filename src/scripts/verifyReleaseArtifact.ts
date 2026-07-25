// Release governance -- Task 5. Read-only re-verification of an already-built release artifact.
import path from 'path';
import { verifyReleaseArtifact } from '../services/release-governance/ReleaseArtifactVerifier';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }

async function main(): Promise<void> {
  const allowed = new Set(['--release-candidate-id']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const releaseCandidateId = arg('--release-candidate-id');
  if (!releaseCandidateId) fail('--release-candidate-id is required', 2);

  const artifactDir = path.resolve(`artifacts/release-governance/${releaseCandidateId}/builds/release-artifact`);
  const verification = await verifyReleaseArtifact(artifactDir);
  console.log(JSON.stringify({ valid: verification.digestMatch, ...verification, mongoReads: 0, mongoWrites: 0, networkReads: 0, productionWrites: 0 }));
  if (!verification.digestMatch) process.exitCode = 20;
}

if (require.main === module) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); if (process.exitCode === undefined) process.exitCode = 25; });
}
