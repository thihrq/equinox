import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { ThreatDatabase } from '../threats/ThreatDatabase';
import { ThreatAnalyzer } from '../threats/ThreatAnalyzer';
import { ThreatAnalysis, ThreatMatchup } from '../threats/Threat';

export class ThreatEngine implements AnalysisEngine {
  public readonly name = 'ThreatEngine';

  private readonly database = new ThreatDatabase();
  private readonly analyzer = new ThreatAnalyzer();

  public execute(context: AnalysisContext): void {
    const threats = this.database.getThreats(context.format);
    const detectedRoles = context.analysis.roles?.detectedRoles ?? {};
    const hasSpeedControl = context.analysis.speed?.hasSpeedControl ?? false;

    const matchups = threats
      .map(threat =>
        this.analyzer.analyzeThreat({
          team: context.selectedPokemon,
          threat,
          format: context.format,
          hasSpeedControl,
          detectedRoles,
        }),
      )
      .sort((a, b) => a.score - b.score);

    const averageScore = matchups.length > 0
      ? Math.round(matchups.reduce((sum, matchup) => sum + matchup.score, 0) / matchups.length)
      : 0;

    const analysis: ThreatAnalysis = {
      averageScore,
      safeThreats: this.filterByLevel(matchups, 'Safe'),
      goodThreats: this.filterByLevel(matchups, 'Good'),
      neutralThreats: this.filterByLevel(matchups, 'Neutral'),
      dangerousThreats: this.filterByLevel(matchups, 'Dangerous'),
      criticalThreats: this.filterByLevel(matchups, 'Critical'),
      matchups,
    };

    context.analysis.threats = analysis;
    context.score.threats = this.calculateThreatScore(context, analysis);
  }

  private filterByLevel(
    matchups: ThreatMatchup[],
    level: ThreatMatchup['level'],
  ): ThreatMatchup[] {
    return matchups.filter(matchup => matchup.level === level);
  }

  private calculateThreatScore(context: AnalysisContext, analysis: ThreatAnalysis): number {
    const threatWeight = context.analysis.meta?.weights.threats ?? 1;
    const score = Math.round(((analysis.averageScore - 50) / 2) * threatWeight);

    if (analysis.safeThreats.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `Boa resposta contra ${analysis.safeThreats.length} ameaça(s) principais`,
        value: analysis.safeThreats.length * 3,
        impact: 'positive',
      });
    }

    if (analysis.criticalThreats.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `${analysis.criticalThreats.length} ameaça(s) crítica(s) ainda pressionam o time`,
        value: -(analysis.criticalThreats.length * 5),
        impact: 'negative',
      });
    }

    if (analysis.dangerousThreats.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `${analysis.dangerousThreats.length} ameaça(s) perigosas exigem atenção`,
        value: -(analysis.dangerousThreats.length * 3),
        impact: 'negative',
      });
    }

    return score;
  }
}
