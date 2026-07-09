// TODO: Implementar a classe/módulo FinalScoreEngine.ts
import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';

export class FinalScoreEngine implements AnalysisEngine {
  public readonly name = 'FinalScoreEngine';

  public execute(context: AnalysisContext): void {
    const genericTotal =
      context.score.coverage +
      context.score.defense +
      context.score.offense +
      context.score.roles +
      context.score.speed +
      context.score.meta +
      context.score.threats +
      context.score.cores +
      context.score.synergy;

    const gauntlet = context.analysis.radicalRedGauntlet;
    const championsRegulation = context.analysis.championsRegulation;

    if (gauntlet) {
      const gauntletObjective =
        (gauntlet.worstBossScore - 50) * 3.1 +
        (gauntlet.consistencyScore - 50) * 2.2 +
        (gauntlet.averageBossScore - 50) * 1.2 -
        gauntlet.criticalThreats.length * 14;

      context.score.total = Math.round(genericTotal * 0.35 + gauntletObjective);
      return;
    }

    if (championsRegulation) {
      const fieldWeight = championsRegulation.battleStyle === 'doubles' ? 1.45 : 0.65;
      const regulationObjective =
        (championsRegulation.score - 50) * 2.45 +
        (championsRegulation.roleCoverage.threatCoverage - 50) * 1.35 +
        (championsRegulation.roleCoverage.speedControl - 50) * 1.2 +
        (championsRegulation.roleCoverage.fieldControl - 50) * fieldWeight +
        (championsRegulation.roleCoverage.megaReadiness - 50) * 0.8;

      context.score.total = Math.round(genericTotal * 0.45 + regulationObjective);
      return;
    }

    context.score.total = genericTotal;
  }
}
