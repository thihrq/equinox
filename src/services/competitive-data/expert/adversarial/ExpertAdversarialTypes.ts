export type ExpertAdversarialCategory = 'legality' | 'generation' | 'damage' | 'speed' | 'coherence' | 'benchmark' | 'full-team' | 'promotion' | 'independence';

export interface ExpertAdversarialFixture {
  fixtureId: string;
  category: ExpertAdversarialCategory;
  expectedDecision: 'rejected' | 'expert-review-required' | 'expert-validated';
  mutation: string;
}

export interface ExpertAdversarialResult {
  fixtureId: string;
  passed: boolean;
  observedDecision: ExpertAdversarialFixture['expectedDecision'];
  findings: string[];
}
