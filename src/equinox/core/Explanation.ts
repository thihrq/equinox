// TODO: Implementar a classe/módulo Explanation.ts
export type ExplanationImpact = 'positive' | 'negative' | 'neutral';

export interface ExplanationEntry {
  engine: string;
  reason: string;
  value: number;
  impact: ExplanationImpact;
  type?: string;
  pokemon?: string;
}