import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { FormatIntelligenceRegistry } from '../formats/FormatIntelligenceRegistry';

export class FormatIntelligenceEngine implements AnalysisEngine {
  public readonly name = 'FormatIntelligenceEngine';

  private readonly registry = new FormatIntelligenceRegistry();

  public execute(context: AnalysisContext): void {
    const profile = this.registry.getProfile(context.format);

    context.analysis.formatIntelligence = profile;

    context.addExplanation({
      engine: this.name,
      reason: `Format intelligence: ${profile.label} uses ${profile.engineStrategy}`,
      value: this.calculateConfidenceAdjustment(profile.dataStatus),
      impact: profile.dataStatus === 'verified' ? 'positive' : 'neutral',
    });

    if (profile.warning) {
      context.addExplanation({
        engine: this.name,
        reason: profile.warning,
        value: 0,
        impact: 'neutral',
      });
    }
  }

  private calculateConfidenceAdjustment(status: string): number {
    if (status === 'verified') return 2;
    if (status === 'community') return 1;
    if (status === 'outdated') return -2;
    return 0;
  }
}
