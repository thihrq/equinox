import * as crypto from 'crypto';

/**
 * Calcula o bucket determinístico (0-99) de um identificador para uma seed
 * dada. Depende apenas de (identifier, seed) — nunca do percentual atual —
 * o que garante a propriedade de amostragem cumulativa exigida pelo adendo
 * 4.1: um identificador selecionado em 5% permanece selecionado em 10%, 25%,
 * etc., desde que a seed não mude.
 */
export function calculateActiveV2CanaryBucket(identifier: string, seed: string): number {
  const hash = crypto.createHash('sha256').update(`${seed}:${identifier}`).digest('hex');
  const intValue = parseInt(hash.slice(0, 8), 16);
  return intValue % 100;
}

/**
 * Decide se um identificador está selecionado para o Active V2 dado um
 * percentual de rollout. Função pura — não lê nem escreve nada.
 */
export function isActiveV2CanarySelected(identifier: string, seed: string, percentage: number): boolean {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;
  return calculateActiveV2CanaryBucket(identifier, seed) < percentage;
}
