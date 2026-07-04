import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { MetaDatabase } from './MetaDatabase';
import { MetaAnalysis } from './MetaFormat';

export class MetaEngine implements AnalysisEngine {
  public readonly name = 'MetaEngine';

  private readonly database = new MetaDatabase();

  public execute(context: AnalysisContext): void {
    const meta = this.database.getFormat(context.format);

    const analysis: MetaAnalysis = {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      threatProfileName: meta.threatProfileName,
      threatCount: meta.threats.length,
      weights: meta.weights,
      notes: meta.notes,
    };

    context.analysis.meta = analysis;

    context.addExplanation({
      engine: this.name,
      reason: `Perfil de ameaças aplicado: ${meta.name} (${meta.threats.length} ameaça(s) no escopo do formato)`,
      value: 0,
      impact: 'neutral',
    });
  }
}
