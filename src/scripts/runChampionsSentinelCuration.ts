import fs from 'fs';
import { artifactRoot, createManifest, generateDrafts, generateMatchups, evaluateFullTeams, loadCurationConfig, selectSentinel, validateDrafts, writeArtifact } from '../services/competitive-data/curation/CompetitiveCurationCore';
import { CurationDisposition } from '../services/competitive-data/curation/CompetitiveCurationTypes';

declare const process: { argv: string[]; env: Record<string, string | undefined>; exitCode?: number };

function main(): void {
  const args = process.argv.slice(2);
  const config = loadCurationConfig(args);
  const selection = selectSentinel(config);
  if (selection.blockers.length > 0) throw new Error(selection.blockers.join(','));
  const root = artifactRoot(selection);
  writeArtifact(root, 'selection.json', selection);
  const drafts = generateDrafts(config, selection);
  if (drafts.length !== 20) throw new Error('SENTINEL_DRAFT_COUNT_INVALID');
  writeArtifact(root, 'drafts.json', drafts);
  const reviews = validateDrafts(config, drafts);
  writeArtifact(root, 'legality.json', reviews.map(review => ({ setId: review.setId, legal: review.legal, findings: review.findings.filter(item => item.blocking) })));
  writeArtifact(root, 'coherence.json', reviews.map(review => ({ setId: review.setId, coherent: review.coherent, findings: review.findings.filter(item => !item.blocking) })));
  writeArtifact(root, 'roles.json', reviews.map(review => ({ setId: review.setId, rolesSupported: review.rolesSupported })));
  const matchups = generateMatchups(drafts, config.package.roster.map(item => item.pokemonId));
  const fullTeams = evaluateFullTeams(config, drafts, selection);
  writeArtifact(root, 'matchups.json', matchups);
  writeArtifact(root, 'full-team.json', fullTeams);
  const crosscheckPath = `${root}/crosscheck.json`;
  const crosscheck = fs.existsSync(crosscheckPath) ? JSON.parse(fs.readFileSync(crosscheckPath, 'utf8')) as { complete?: boolean } : { complete: false, warning: 'Cross-check not executed; human review required.' };
  const dispositions: Record<CurationDisposition, number> = { 'agent-reviewed': 0, 'human-review-required': 0, rejected: 0 };
  const consolidation = drafts.map(draft => {
    const review = reviews.find(item => item.setId === draft.setId);
    const disposition: CurationDisposition = !review?.legal ? 'rejected' : crosscheck.complete ? 'agent-reviewed' : 'human-review-required';
    dispositions[disposition] += 1;
    return { ...draft, reviewStatus: disposition, status: 'draft' as const, sourceType: 'generated' as const, humanReviewed: false as const, automaticPromotionAllowed: false as const };
  });
  writeArtifact(root, 'consolidation.json', consolidation);
  const audit = { selectionCount: selection.selectedPokemonIds.length, draftCount: drafts.length, matchupScenarios: matchups.length, fullTeamEvaluations: fullTeams.length, crosscheckComplete: Boolean(crosscheck.complete), allDraftsGenerated: consolidation.every(item => item.sourceType === 'generated' && item.status === 'draft'), mongoReads: 0, mongoWrites: 0, productionWrites: 0, findings: [] };
  writeArtifact(root, 'audit.json', audit);
  writeArtifact(root, 'run-manifest.json', createManifest(selection, drafts, dispositions));
  console.log(JSON.stringify({ root, sentinelRunId: selection.sentinelRunId, selected: selection.selectedPokemonIds.length, drafts: drafts.length, dispositions, crosscheckComplete: Boolean(crosscheck.complete), mongoReads: 0, mongoWrites: 0, productionWrites: 0 }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
