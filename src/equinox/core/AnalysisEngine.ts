// TODO: Implementar a classe/módulo AnalysisEngine.ts
import { AnalysisContext } from './AnalysisContext';

export interface AnalysisEngine {
  readonly name: string;
  execute(context: AnalysisContext): Promise<void> | void;
}