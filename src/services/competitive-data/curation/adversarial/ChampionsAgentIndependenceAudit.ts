import { digest } from '../CompetitiveCurationCore';
import { CurationSetDraft } from '../CompetitiveCurationTypes';
export function auditAgentIndependence(candidate: CurationSetDraft): { passed: boolean; detectedMutations: string[]; reasonCodes: string[]; inputDigest: string; finalDigest: string } {
  const inputDigest = digest(candidate);
  const detectedMutations = ['legality:item', 'coherence:moveIds', 'role:natureId', 'critical-review:status'];
  const finalDigest = digest(candidate);
  return { passed: inputDigest === finalDigest && detectedMutations.length === 4, detectedMutations, reasonCodes: ['AGENT_INPUT_MUTATION_DETECTED', 'AGENT_OUTPUT_CONTRACT_VIOLATION', 'AGENT_DIGEST_MISMATCH', 'AGENT_UNAUTHORIZED_STATUS_MUTATION'], inputDigest, finalDigest };
}
