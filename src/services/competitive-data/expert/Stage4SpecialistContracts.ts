import { Stage4CandidateContext, Stage4SpecialistResult } from './Stage4ExpertTypes';

export type Stage4SpecialistId = 'deterministic-legality' | 'damage-speed' | 'set-coherence' | 'role-archetype' | 'doubles-strategy' | 'full-team' | 'competitive-benchmark' | 'critical-review' | 'format-rules' | 'export-integrity' | 'evidence-audit';
export type Stage4Specialist = (context: Stage4CandidateContext) => Stage4SpecialistResult;

export const STAGE4_SPECIALIST_VERSIONS: Readonly<Record<Stage4SpecialistId, string>> = {
  'deterministic-legality': 'deterministic-legality-v1',
  'damage-speed': 'damage-speed-specialist-v1',
  'set-coherence': 'set-coherence-specialist-v1',
  'role-archetype': 'role-archetype-specialist-v1',
  'doubles-strategy': 'doubles-strategy-specialist-v1',
  'full-team': 'full-team-specialist-v1',
  'competitive-benchmark': 'competitive-benchmark-specialist-v1',
  'critical-review': 'critical-review-specialist-v1',
  'format-rules': 'format-rules-specialist-v1',
  'export-integrity': 'export-integrity-specialist-v1',
  'evidence-audit': 'evidence-audit-specialist-v1',
};
