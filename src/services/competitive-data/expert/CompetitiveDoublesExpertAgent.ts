import { CompetitiveDoublesExpertContext } from './CompetitiveDoublesExpertContext';
import { ExpertComponentResult } from './CompetitiveDoublesExpertTypes';

export interface CompetitiveDoublesExpertAgent {
  readonly agentId: 'competitive-doubles-expert';
  validate(context: CompetitiveDoublesExpertContext): ExpertComponentResult;
}
