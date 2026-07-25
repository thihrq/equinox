declare const process: { argv: string[]; exitCode?: number };
import { validateChampionsInGameRosterCaptureFile } from '../equinox/data-import/champions/sources/ChampionsInGameRosterCaptureValidator';

const result = validateChampionsInGameRosterCaptureFile(process.argv[2] ?? '');
console.log(JSON.stringify({ valid: result.blockers.length === 0, blockers: result.blockers, unresolvedEntries: result.unresolvedEntries }, null, 2));
if (result.blockers.length > 0) process.exitCode = 1;
