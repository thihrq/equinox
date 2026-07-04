import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { DamageInterpreter } from '../damage/DamageInterpreter';
import { MatchupAnalyzer } from '../damage/MatchupAnalyzer';
import { ThreatDatabase } from '../threats/ThreatDatabase';

export class DamageEngine implements AnalysisEngine {
  public readonly name = 'DamageEngine';

  private readonly analyzer = new MatchupAnalyzer();
  private readonly interpreter = new DamageInterpreter();
  private readonly fallbackThreatDatabase = new ThreatDatabase();

  public execute(context: AnalysisContext): void {
    const threats = context.analysis.threats?.matchups.map(matchup => matchup.threat)
      ?? this.fallbackThreatDatabase.getThreats(context.format);

    const hasSpeedControl = context.analysis.speed?.hasSpeedControl ?? false;

    const matchups = threats.map(threat =>
      this.analyzer.analyzeThreatMatchup({
        team: context.selectedPokemon,
        threat,
        format: context.format,
        hasSpeedControl,
      }),
    );

    const report = this.interpreter.buildReport(matchups);
    context.analysis.damage = report;

    if (report.favorableMatchups.length + report.dominantMatchups.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `Damage Lite encontrou ${report.favorableMatchups.length + report.dominantMatchups.length} matchup(s) favoráveis`,
        value: 0,
        impact: 'neutral',
      });
    }

    if (report.dangerousMatchups.length > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `Damage Lite marcou ${report.dangerousMatchups.length} matchup(s) perigosos para revisão`,
        value: 0,
        impact: 'neutral',
      });
    }
  }
}
