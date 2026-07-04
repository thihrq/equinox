// TODO: Implementar a classe/módulo WeaknessScoreEngine.ts
import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';

const RADICAL_RED_THREAT_TYPES = new Set([
  'Water',
  'Ice',
  'Fighting',
  'Ghost',
  'Poison',
  'Dragon',
  'Steel',
]);

export class WeaknessScoreEngine implements AnalysisEngine {
  public readonly name = 'WeaknessScoreEngine';

  public execute(context: AnalysisContext): void {
    let fatalUncovered = 0;
    let normalUncovered = 0;
    let totalWeaknesses = 0;
    let radicalRedPenalty = 0;

    for (const item of context.analysis.defensiveMatrix) {
      if (item.hasFatalWeakness) {
        totalWeaknesses += 2;

        if (!item.hasReliableSwitchIn) {
          fatalUncovered += 1;

          if (
            context.format === 'radical_red' &&
            RADICAL_RED_THREAT_TYPES.has(item.type)
          ) {
            radicalRedPenalty += 3;
          }

          context.addExplanation({
            engine: this.name,
            reason: `Fraqueza 4x sem switch-in confiável contra ${item.type}`,
            value: -5,
            impact: 'negative',
            type: item.type,
          });
        }
      } else if (item.hasWeakness) {
        totalWeaknesses += 1;

        if (!item.hasReliableSwitchIn) {
          normalUncovered += 1;

          if (
            context.format === 'radical_red' &&
            RADICAL_RED_THREAT_TYPES.has(item.type)
          ) {
            radicalRedPenalty += 1;
          }

          context.addExplanation({
            engine: this.name,
            reason: `Fraqueza 2x sem switch-in confiável contra ${item.type}`,
            value: -2,
            impact: 'negative',
            type: item.type,
          });
        }
      }
    }

    context.analysis.fatalUncovered = fatalUncovered;
    context.analysis.normalUncovered = normalUncovered;
    context.analysis.totalWeaknesses = totalWeaknesses;

    context.score.defense = -(
      fatalUncovered * 5 +
      normalUncovered * 2 +
      radicalRedPenalty
    );
  }
}