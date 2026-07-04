// TODO: Implementar a classe/módulo AnalysisPipeline.ts
import { AnalysisContext } from './AnalysisContext';
import { AnalysisEngine } from './AnalysisEngine';

export class AnalysisPipeline {
  private readonly engines: AnalysisEngine[] = [];

  public use(engine: AnalysisEngine): this {
    this.engines.push(engine);
    return this;
  }

  public async run(context: AnalysisContext): Promise<AnalysisContext> {
    for (const engine of this.engines) {
      await engine.execute(context);
    }

    return context;
  }
}