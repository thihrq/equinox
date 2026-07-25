import fs from 'fs';
import path from 'path';
declare const process: { exitCode?: number };
const root = path.resolve('artifacts/champions-curation/mb');
const errors: string[] = [];
for (const run of fs.existsSync(root) ? fs.readdirSync(root) : []) {
  const dir = path.join(root, run);
  if (!fs.statSync(dir).isDirectory()) continue;
  const selection = JSON.parse(fs.readFileSync(path.join(dir, 'selection.json'), 'utf8')) as { selectedPokemonIds: string[]; blockers: string[] };
  const drafts = JSON.parse(fs.readFileSync(path.join(dir, 'drafts.json'), 'utf8')) as Array<{ sourceType: string; status: string; humanReviewed: boolean; automaticPromotionAllowed: boolean }>;
  if (selection.selectedPokemonIds.length !== 10) errors.push(`${run}:SELECTION_COUNT`);
  if (selection.blockers.length > 0) errors.push(`${run}:SELECTION_BLOCKED`);
  if (drafts.length !== 20) errors.push(`${run}:DRAFT_COUNT`);
  if (!drafts.every(draft => draft.sourceType === 'generated' && draft.status === 'draft' && draft.humanReviewed === false && draft.automaticPromotionAllowed === false)) errors.push(`${run}:DRAFT_SAFETY_CONTRACT`);
}
console.log(JSON.stringify({ valid: errors.length === 0, errors, mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
if (errors.length > 0) process.exitCode = 1;
