import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { CoachInterpreter } from './CoachInterpreter';

export class CoachEngine implements AnalysisEngine {
  public readonly name = 'CoachEngine';

  private readonly interpreter = new CoachInterpreter();

  public execute(context: AnalysisContext): void {
    context.analysis.coach = this.interpreter.interpret(context);

    context.addExplanation({
      engine: this.name,
      reason: 'Plano de jogo gerado a partir de roles, speed, cobertura, meta e ameaças',
      value: 0,
      impact: 'neutral',
    });
  }
}
