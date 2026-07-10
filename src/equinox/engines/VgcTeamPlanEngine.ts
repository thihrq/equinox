import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { evaluateVgcTeamPlan } from '../vgc/VgcTeamBuilding';

export class VgcTeamPlanEngine implements AnalysisEngine {
  public readonly name = 'VgcTeamPlanEngine';

  public execute(context: AnalysisContext): void {
    const analysis = evaluateVgcTeamPlan(context.selectedPokemon, context.format);

    context.analysis.vgcTeamPlan = analysis;

    const normalizedContribution = Math.round((analysis.score - 50) * 0.85);
    context.score.cores += normalizedContribution;

    context.addExplanation({
      engine: this.name,
      reason: `Plano VGC detectado: ${analysis.archetype.label} (${analysis.score}%)`,
      value: normalizedContribution,
      impact: normalizedContribution >= 0 ? 'positive' : 'negative',
    });

    context.addExplanation({
      engine: this.name,
      reason: analysis.planSummary,
      value: 0,
      impact: 'neutral',
    });

    for (const role of analysis.roleCoverage.missingCriticalRoles.slice(0, 3)) {
      context.addExplanation({
        engine: this.name,
        reason: `Função crítica VGC ausente: ${role}`,
        value: -8,
        impact: 'negative',
      });
    }
  }
}
