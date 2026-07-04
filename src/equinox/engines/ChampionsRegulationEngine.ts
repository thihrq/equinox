import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { ChampionsRegulationScorer } from '../champions/ChampionsRegulationScorer';

export class ChampionsRegulationEngine implements AnalysisEngine {
  public readonly name = 'ChampionsRegulationEngine';
  private readonly scorer = new ChampionsRegulationScorer();

  public execute(context: AnalysisContext): void {
    if (!this.scorer.isApplicable(context.format)) return;

    const analysis = this.scorer.scoreTeam(context.selectedPokemon, context.format);
    context.analysis.championsRegulation = analysis;

    context.score.meta += Math.round((analysis.score - 50) / 2.5);
    context.score.threats += Math.round((analysis.roleCoverage.threatCoverage - 50) / 3);
    context.score.speed += Math.round((analysis.roleCoverage.speedControl - 50) / 4);
    context.score.roles += Math.round((analysis.roleCoverage.roleCompression - 50) / 4);
    context.score.cores += Math.round((analysis.score - 50) / 3);

    context.addExplanation({
      engine: this.name,
      reason: `Pokémon Champions Regulation ${analysis.regulationSet}: ${analysis.level} fit (${analysis.score}/100).`,
      value: analysis.score,
      impact: analysis.score >= 70 ? 'positive' : analysis.score >= 58 ? 'neutral' : 'negative',
      type: 'regulation',
    });

    for (const recommendation of analysis.recommendations.slice(0, 2)) {
      context.addExplanation({
        engine: this.name,
        reason: recommendation,
        value: analysis.score,
        impact: 'neutral',
        type: 'regulation-recommendation',
      });
    }
  }
}
