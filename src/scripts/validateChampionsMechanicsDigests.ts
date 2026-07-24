declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const crypto = require('crypto') as any;

const inputPath = process.argv[2];
const manifestPath = inputPath && fs.existsSync(path.resolve(inputPath)) && fs.statSync(path.resolve(inputPath)).isDirectory()
  ? path.join(path.resolve(inputPath), 'mechanics-manifest.json')
  : inputPath;
const failures: string[] = [];
if (!manifestPath || !fs.existsSync(path.resolve(manifestPath)) || !fs.statSync(path.resolve(manifestPath)).isFile()) {
  failures.push('MECHANICS_SOURCE_REVISION_MISSING');
} else {
  const absoluteManifest = path.resolve(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(absoluteManifest, 'utf8')) as any;
  if (!manifest.sourceRevision || !Array.isArray(manifest.files) || manifest.files.length === 0) failures.push('MECHANICS_SOURCE_REVISION_MISSING');
  for (const file of manifest.files ?? []) {
    const filePath = path.resolve(path.dirname(absoluteManifest), file.filename ?? file.name);
    if (!fs.existsSync(filePath)) {
      failures.push(`MECHANICS_FILE_MISSING:${file.filename ?? file.name}`);
      continue;
    }
    const digest = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (digest !== String(file.sha256).replace(/^sha256:/, '')) failures.push(`MECHANICS_FILE_DIGEST_MISMATCH:${file.filename ?? file.name}`);
  }
}
console.log(JSON.stringify({ valid: failures.length === 0, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
