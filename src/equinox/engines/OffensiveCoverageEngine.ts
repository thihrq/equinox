import { TYPE_CHART } from '../../utils/TypeChart';
import {
  AnalysisContext,
  OffensiveCoverageAnalysis,
  OffensiveTypeSummary,
} from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { getPokemonTypes } from '../utils/PokemonUtils';

/**
 * Primeira versão do CoverageEngine ofensivo.
 *
 * Nesta Sprint usamos apenas STAB natural, baseado nos tipos dos membros do time.
 * Não inferimos golpes ainda, para evitar recomendações falsas.
 *
 * Futuramente, quando movesets forem estruturados no banco, este motor poderá
 * considerar coverage moves, STABs reais, priority, setup e moves por formato.
 */
export class OffensiveCoverageEngine implements AnalysisEngine {
  public readonly name = 'OffensiveCoverageEngine';

  public execute(context: AnalysisContext): void {
    const allTypes = Object.keys(TYPE_CHART);
    const uniqueAttackTypes = this.getUniqueAttackTypes(context);

    const matrix: OffensiveTypeSummary[] = allTypes.map(defendingType => {
      const coveringAttackTypes = uniqueAttackTypes.filter(attackType => {
        const multiplier = this.getSingleTypeMultiplier(attackType, defendingType);
        return multiplier > 1;
      });

      const bestMultiplier = uniqueAttackTypes.reduce((best, attackType) => {
        const multiplier = this.getSingleTypeMultiplier(attackType, defendingType);
        return Math.max(best, multiplier);
      }, 1);

      return {
        defendingType,
        bestMultiplier,
        coveringAttackTypes,
        isCovered: bestMultiplier > 1,
      };
    });

    const coveredTypes = matrix
      .filter(item => item.isCovered)
      .map(item => item.defendingType);

    const uncoveredTypes = matrix
      .filter(item => !item.isCovered)
      .map(item => item.defendingType);

    const coverageRatio = allTypes.length > 0 ? coveredTypes.length / allTypes.length : 0;

    const analysis: OffensiveCoverageAnalysis = {
      matrix,
      coveredTypes,
      uncoveredTypes,
      coverageRatio,
      uniqueAttackTypes,
    };

    context.analysis.offensiveCoverage = analysis;
    context.score.coverage = this.calculateCoverageScore(context, analysis);
  }

  private getUniqueAttackTypes(context: AnalysisContext): string[] {
    const attackTypes = new Set<string>();

    for (const pokemon of context.selectedPokemon) {
      const types = getPokemonTypes(pokemon, context.format);

      for (const type of types) {
        const normalizedType = this.resolveTypeKey(type);

        if (normalizedType) {
          attackTypes.add(normalizedType);
        }
      }
    }

    return [...attackTypes];
  }

  private getSingleTypeMultiplier(attackType: string, defendingType: string): number {
    const resolvedAttackType = this.resolveTypeKey(attackType);

    if (!resolvedAttackType) return 1;

    const defendingKeys = Object.keys(TYPE_CHART[resolvedAttackType] ?? {});
    const resolvedDefendingType = defendingKeys.find(
      key => key.toLowerCase() === defendingType.toLowerCase(),
    );

    if (!resolvedDefendingType) return 1;

    return TYPE_CHART[resolvedAttackType][resolvedDefendingType] ?? 1;
  }

  private resolveTypeKey(type: string): string | undefined {
    return Object.keys(TYPE_CHART).find(
      key => key.toLowerCase() === type.toLowerCase(),
    );
  }

  private calculateCoverageScore(
    context: AnalysisContext,
    analysis: OffensiveCoverageAnalysis,
  ): number {
    let score = 0;

    const coveredCount = analysis.coveredTypes.length;
    const uncoveredCount = analysis.uncoveredTypes.length;

    score += coveredCount * 3;
    score -= uncoveredCount * 2;

    context.addExplanation({
      engine: this.name,
      reason: `Cobertura ofensiva STAB cobre ${coveredCount} tipo(s)`,
      value: coveredCount * 3,
      impact: 'positive',
    });

    if (uncoveredCount > 0) {
      context.addExplanation({
        engine: this.name,
        reason: `Cobertura ofensiva STAB não pressiona ${uncoveredCount} tipo(s)`,
        value: -(uncoveredCount * 2),
        impact: 'negative',
      });
    }

    if (analysis.uniqueAttackTypes.length >= 6) {
      score += 8;

      context.addExplanation({
        engine: this.name,
        reason: 'Time possui grande diversidade de STABs ofensivos',
        value: +8,
        impact: 'positive',
      });
    }

    if (analysis.coverageRatio >= 0.7) {
      score += 10;

      context.addExplanation({
        engine: this.name,
        reason: 'Cobertura ofensiva STAB acima de 70%',
        value: +10,
        impact: 'positive',
      });
    }

    if (analysis.coverageRatio < 0.4) {
      score -= 10;

      context.addExplanation({
        engine: this.name,
        reason: 'Cobertura ofensiva STAB abaixo de 40%',
        value: -10,
        impact: 'negative',
      });
    }

    return score;
  }
}