import { EvidenceAuthority, ChampionsCompetitivePackage } from '../../data-packs/champions/ChampionsPackageTypes';

export interface AuthorityFinding {
  field: string;
  message: string;
  blocking: boolean;
}

export function validateChampionsSourceAuthority(data: ChampionsCompetitivePackage): AuthorityFinding[] {
  const findings: AuthorityFinding[] = [];
  const allowed: EvidenceAuthority[] = ['official', 'canonical-mechanics', 'in-game-verified', 'community', 'agent-generated', 'human-reviewed'];

  for (const source of data.sourceManifest.sources) {
    if (!allowed.includes(source.authority)) {
      findings.push({ field: source.sourceId, message: 'unknown evidence authority', blocking: true });
    }
    if (!source.url || !source.digest || source.digest.startsWith('pending-')) {
      findings.push({ field: source.sourceId, message: 'source URL or immutable digest is incomplete', blocking: true });
    }
  }

  for (const entry of data.roster) {
    if (entry.legal && entry.sourceEvidence.length === 0) {
      findings.push({ field: `roster.${entry.pokemonId}`, message: 'legal roster entry has no evidence', blocking: true });
    }
  }

  return findings;
}
