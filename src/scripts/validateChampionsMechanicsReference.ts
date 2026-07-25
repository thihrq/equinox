import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isReferenceOfflineEnabled } from '../services/competitive-data/reference-conformance/ReferenceFlags';
import { stableDigest } from '../services/competitive-data/reference-conformance/contracts/ReferenceConformanceContracts';

function arg(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function fail(message: string, code: number): never { console.error(message); process.exitCode = code; throw new Error(message); }
function digestFile(file: string): string { return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`; }
function writeAtomic(file: string, value: unknown): void { const temporary = `${file}.tmp-${process.pid}`; fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temporary, file); }

function main(): void {
  const allowed = new Set(['--run-id', '--output-dir']);
  for (let i = 2; i < process.argv.length; i += 1) { if (process.argv[i].startsWith('--') && !allowed.has(process.argv[i])) fail(`Unknown argument: ${process.argv[i]}`, 2); if (process.argv[i].startsWith('--')) i += 1; }
  const runId = arg('--run-id');
  const outputDir = arg('--output-dir') ?? `artifacts/competitive-production-readiness/${runId ?? 'missing-run-id'}/mechanics-reference`;
  if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) fail('Valid --run-id is required', 2);
  if (!isReferenceOfflineEnabled()) fail('Offline reference check requires both reference flags disabled', 4);
  const damagePath = path.resolve(outputDir, 'damage-canonical-fixtures.json');
  const speedPath = path.resolve(outputDir, 'speed-canonical-fixtures.json');
  const digestPath = path.resolve(outputDir, 'reference-digests.json');
  for (const file of [damagePath, speedPath, digestPath]) if (!fs.existsSync(file)) fail(`Reference artifact missing: ${file}`, 4);
  const damage = JSON.parse(fs.readFileSync(damagePath, 'utf8')) as { fixtures?: unknown[] };
  const speed = JSON.parse(fs.readFileSync(speedPath, 'utf8')) as { fixtures?: unknown[] };
  const digests = JSON.parse(fs.readFileSync(digestPath, 'utf8')) as { damage?: string; speed?: string };
  if (!damage.fixtures?.length || !speed.fixtures?.length) fail('Reference fixture package is empty', 18);
  if (digests.damage !== stableDigest(JSON.parse(JSON.stringify(damage.fixtures[0])))) fail('Damage fixture digest mismatch', 6);
  if (digests.speed !== stableDigest(JSON.parse(JSON.stringify(speed.fixtures[0])))) fail('Speed fixture digest mismatch', 6);
  const result = { valid: true, runId, damageFixtures: damage.fixtures.length, speedFixtures: speed.fixtures.length, referenceIndependence: 'pending-audit', mongoReads: 0, mongoWrites: 0, productionWrites: 0 };
  writeAtomic(path.resolve(outputDir, 'reference-check.json'), result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  if (process.exitCode === undefined) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 19;
  }
}
