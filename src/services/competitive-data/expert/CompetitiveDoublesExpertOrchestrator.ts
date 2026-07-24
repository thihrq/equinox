import { CompetitiveDoublesExpertContext } from './CompetitiveDoublesExpertContext';
import { ExpertComponentResult } from './CompetitiveDoublesExpertTypes';

export interface CompetitiveDoublesExpertOrchestrator {
  run(context: CompetitiveDoublesExpertContext): ExpertComponentResult;
}
