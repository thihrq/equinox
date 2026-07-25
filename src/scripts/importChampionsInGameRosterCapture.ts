declare const require: (moduleName: string) => any;
declare const process: { argv: string[]; exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const { importChampionsOfficialRoster } = require('../equinox/data-import/champions/sources/ChampionsOfficialRosterSource') as any;
const { validateChampionsInGameRosterCaptureFile } = require('../equinox/data-import/champions/sources/ChampionsInGameRosterCaptureValidator') as any;

const capturePath = process.argv[2];
if (!capturePath) {
  console.error('Informe o caminho de official-roster-ingame-capture.json.');
  process.exitCode = 2;
} else {
  const resolvedCapturePath = fs.existsSync(path.resolve(capturePath)) && fs.statSync(path.resolve(capturePath)).isDirectory()
    ? path.join(path.resolve(capturePath), 'official-roster-ingame-capture.json')
    : capturePath;
  const validation = validateChampionsInGameRosterCaptureFile(resolvedCapturePath);
  const capture = validation.capture;
  const unresolved = (capture?.entries ?? []).filter((entry: any) => !entry.displayedName);
  if (validation.blockers.length > 0 || unresolved.length > 0) {
    const blockers = [...validation.blockers];
    if (unresolved.length > 0 && !blockers.includes('INGAME_ROSTER_ENTRY_UNRESOLVED')) blockers.push('INGAME_ROSTER_ENTRY_UNRESOLVED');
    console.error(JSON.stringify({ imported: false, blockers }, null, 2));
    process.exitCode = 1;
  } else {
    const rosterInput = { pokemon: capture.entries.map((entry: any) => ({ name: entry.displayedName, formId: entry.displayedForm })) };
    const temporaryPath = path.join(path.dirname(path.resolve(resolvedCapturePath)), '.roster-import.json');
    fs.writeFileSync(temporaryPath, JSON.stringify(rosterInput), 'utf8');
    try {
      const roster = importChampionsOfficialRoster(temporaryPath);
      const output = path.join(path.dirname(path.resolve(resolvedCapturePath)), 'official-roster-ingame.normalized.json');
      fs.writeFileSync(output, `${JSON.stringify({ ...capture, entries: roster, verificationStatus: 'in-game-verified' }, null, 2)}\n`, 'utf8');
      console.log(`[Equinox] captura in-game importada: ${roster.length} registros.`);
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
}
