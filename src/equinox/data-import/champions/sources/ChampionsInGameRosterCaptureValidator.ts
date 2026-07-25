declare const require: (moduleName: string) => any;

const fs = require('fs') as any;
const path = require('path') as any;
const crypto = require('crypto') as any;

export interface InGameRosterCaptureValidation {
  capture?: any;
  blockers: string[];
  unresolvedEntries: number;
}

export function validateChampionsInGameRosterCaptureFile(capturePath: string): InGameRosterCaptureValidation {
  const blockers: string[] = [];
  const add = (code: string): void => { if (!blockers.includes(code)) blockers.push(code); };
  let absolutePath = path.resolve(capturePath);
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
    absolutePath = path.join(absolutePath, 'official-roster-ingame-capture.json');
  }
  if (!capturePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return { blockers: ['INGAME_ROSTER_CAPTURE_MISSING'], unresolvedEntries: 0 };

  const capture = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as any;
  const directory = path.dirname(absolutePath);
  const evidenceDirectory = path.join(directory, 'evidence');
  const manifestPath = path.join(directory, 'capture-manifest.json');
  if (capture.regulationId !== 'M-B' || !capture.snapshotId || !capture.capturedAt || !capture.capturedBy || !capture.gameVersion || !capture.locale || !Array.isArray(capture.entries)) {
    add('INGAME_ROSTER_CAPTURE_INCOMPLETE');
  }
  if (capture.captureComplete !== true || capture.entries.length === 0) add('INGAME_ROSTER_CAPTURE_INCOMPLETE');
  const unresolvedEntries = (capture.entries ?? []).filter((entry: any) => !entry.displayedName && !entry.iconReference).length;
  if (unresolvedEntries > 0) add('INGAME_ROSTER_ENTRY_UNRESOLVED');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(evidenceDirectory)) {
    add('INGAME_ROSTER_EVIDENCE_MISSING');
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as any;
    if (manifest.snapshotId !== capture.snapshotId || manifest.regulationId !== 'M-B' || manifest.captureComplete !== true) add('INGAME_ROSTER_CAPTURE_INCOMPLETE');
    const evidence = new Map<string, any>((manifest.files ?? []).map((file: any) => [file.fileId, file] as [string, any]));
    for (const entry of capture.entries ?? []) {
      const file = evidence.get(entry.evidenceFileId);
      if (!file || (!entry.displayedName && !entry.iconReference)) {
        add('INGAME_ROSTER_EVIDENCE_MISSING');
        continue;
      }
      const evidencePath = path.resolve(directory, String(file.filename));
      if (!evidencePath.startsWith(path.resolve(directory)) || !fs.existsSync(evidencePath)) {
        add('INGAME_ROSTER_EVIDENCE_MISSING');
        continue;
      }
      const digest = crypto.createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
      if (digest !== String(file.sha256).replace(/^sha256:/, '')) add('INGAME_ROSTER_DIGEST_MISMATCH');
    }
  }
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as any : {};
  const attestations = [...(capture.reviewerAttestations ?? []), ...(manifest.reviewerAttestations ?? [])];
  const approved = attestations.filter((item: any) => item.result === 'approved');
  if (approved.length === 0) add('INGAME_ROSTER_REVIEW_MISSING');
  if (attestations.some((item: any) => item.result === 'rejected')) add('INGAME_ROSTER_REVIEW_MISMATCH');
  return { capture, blockers, unresolvedEntries };
}
