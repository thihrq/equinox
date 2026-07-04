import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { AIBuilderDecisionEngine } from '../builder/AIBuilderDecisionEngine';

export class AIBuilderEngine implements AnalysisEngine {
  public readonly name = 'AIBuilderEngine';

  private readonly decisionEngine = new AIBuilderDecisionEngine();

  public execute(context: AnalysisContext): void {
    const analysis = this.decisionEngine.analyze(context);

    context.analysis.aiBuilder = analysis;
    context.score.cores = analysis.decisionScore;

    context.addExplanation({
      engine: this.name,
      reason: `AI Builder classified this composition as ${analysis.profile.name}`,
      value: analysis.decisionScore,
      impact: analysis.decisionScore >= 0 ? 'positive' : 'negative',
    });

    context.addExplanation({
      engine: this.name,
      reason: `Decision confidence: ${analysis.confidence}%`,
      value: 0,
      impact: 'neutral',
    });
  }
}
