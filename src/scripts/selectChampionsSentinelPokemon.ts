import { artifactRoot, loadCurationConfig, selectSentinel, writeArtifact } from '../services/competitive-data/curation/CompetitiveCurationCore';
declare const process: { argv: string[]; exitCode?: number };
try { const selection = selectSentinel(loadCurationConfig(process.argv.slice(2))); if (selection.blockers.length > 0) throw new Error(selection.blockers.join(',')); writeArtifact(artifactRoot(selection), 'selection.json', selection); console.log(JSON.stringify(selection, null, 2)); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
