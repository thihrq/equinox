import { PokemonType, ALL_POKEMON_TYPES, calculatePokemonDefensiveMultiplier } from './TeamDefensiveProfile';

export interface CandidatePoolQuota {
  offensiveSynergy: number;
  defensiveAnswers: number;
  pivots: number;
  utility: number;
  spreadMitigation: number;
}

export interface CandidateDefensiveContribution {
  candidateId: string;

  resistedTypes: readonly PokemonType[];
  immuneTypes: readonly PokemonType[];
  safeSwitchInTypes: readonly PokemonType[];

  providesWideGuard: boolean;
  providesIntimidate: boolean;
  providesFakeOut: boolean;
  providesResistantRedirection: boolean;

  defensiveAnswerScore: number;
}

export const DEFAULT_CANDIDATE_POOL_QUOTA: CandidatePoolQuota = {
  offensiveSynergy: 20,
  defensiveAnswers: 10,
  pivots: 4,
  utility: 4,
  spreadMitigation: 2,
};

export function evaluateCandidateDefensiveContribution(
  candidate: any,
  neededWeakTypes: PokemonType[] = [],
): CandidateDefensiveContribution {
  const candidateId = candidate._id || candidate.id || candidate.species || candidate.name;
  const types: PokemonType[] = candidate.types || ['Normal'];
  const moves: string[] = (candidate.moves || []).map((m: any) => String(m).toLowerCase().replace(/[\s-_]/g, ''));
  const ability: string = String(candidate.ability || '').toLowerCase().replace(/[\s-_]/g, '');

  const resistedTypes: PokemonType[] = [];
  const immuneTypes: PokemonType[] = [];
  const safeSwitchInTypes: PokemonType[] = [];

  for (const attackType of ALL_POKEMON_TYPES) {
    const mult = calculatePokemonDefensiveMultiplier(attackType, types);
    if (mult === 0.0) {
      immuneTypes.push(attackType);
      safeSwitchInTypes.push(attackType);
    } else if (mult <= 0.5) {
      resistedTypes.push(attackType);
      safeSwitchInTypes.push(attackType);
    }
  }

  const providesWideGuard = moves.includes('wideguard');
  const providesIntimidate = ability.includes('intimidate');
  const providesFakeOut = moves.includes('fakeout');
  const providesResistantRedirection = (moves.includes('followme') || moves.includes('ragepowder')) && resistedTypes.length > 0;

  let defensiveAnswerScore = (resistedTypes.length * 10) + (immuneTypes.length * 20);

  // Bônus adicional para cada tipo especificamente necessitado no contexto
  for (const neededType of neededWeakTypes) {
    if (immuneTypes.includes(neededType)) defensiveAnswerScore += 30;
    else if (resistedTypes.includes(neededType)) defensiveAnswerScore += 20;
  }

  return {
    candidateId,
    resistedTypes,
    immuneTypes,
    safeSwitchInTypes,
    providesWideGuard,
    providesIntimidate,
    providesFakeOut,
    providesResistantRedirection,
    defensiveAnswerScore,
  };
}

export function stratifyCandidatePool(
  candidates: readonly any[],
  context: any = {},
  quota: CandidatePoolQuota = DEFAULT_CANDIDATE_POOL_QUOTA,
): readonly any[] {
  const selected = new Map<string, any>();
  const neededWeakTypes: PokemonType[] = context.neededWeakTypes || ['Ice'];

  // Helper para obter chave única do candidato
  const getCandidateKey = (cand: any) =>
    `${cand.species || cand.name}_${cand.item || ''}_${cand.ability || ''}`;

  // 1. Quota Ofensiva (Synergy) — Selecionar os primeiros N candidatos com maior sinergia
  const sortedBySynergy = [...candidates]; // assume ordem original já prioriza sinergia
  for (const cand of sortedBySynergy) {
    if (selected.size >= quota.offensiveSynergy) break;
    const key = getCandidateKey(cand);
    if (!selected.has(key)) {
      selected.set(key, cand);
    }
  }

  // 2. Respostas Defensivas — Selecionar candidatos com contribuições defensivas para tipos necessitados
  const defensiveEvaluated = candidates.map(cand => ({
    cand,
    contrib: evaluateCandidateDefensiveContribution(cand, neededWeakTypes),
  })).sort((a, b) => b.contrib.defensiveAnswerScore - a.contrib.defensiveAnswerScore);

  let defensiveAdded = 0;
  for (const { cand } of defensiveEvaluated) {
    if (defensiveAdded >= quota.defensiveAnswers) break;
    const key = getCandidateKey(cand);
    if (!selected.has(key)) {
      selected.set(key, cand);
      defensiveAdded++;
    }
  }

  // 3. Pivots — U-turn, Volt Switch, Parting Shot, Flip Turn
  let pivotsAdded = 0;
  for (const cand of candidates) {
    if (pivotsAdded >= quota.pivots) break;
    const moves: string[] = (cand.moves || []).map((m: any) => String(m).toLowerCase().replace(/[\s-_]/g, ''));
    const isPivot = moves.some(m => ['uturn', 'voltswitch', 'partingshot', 'flipturn'].includes(m));
    if (isPivot) {
      const key = getCandidateKey(cand);
      if (!selected.has(key)) {
        selected.set(key, cand);
        pivotsAdded++;
      }
    }
  }

  // 4. Utility / Support
  let utilityAdded = 0;
  for (const cand of candidates) {
    if (utilityAdded >= quota.utility) break;
    const moves: string[] = (cand.moves || []).map((m: any) => String(m).toLowerCase().replace(/[\s-_]/g, ''));
    const isUtility = moves.some(m => ['taunt', 'tailwind', 'willowisp', 'spore', 'followme', 'ragepowder'].includes(m));
    if (isUtility) {
      const key = getCandidateKey(cand);
      if (!selected.has(key)) {
        selected.set(key, cand);
        utilityAdded++;
      }
    }
  }

  // 5. Mitigação de Golpe em Área (Wide Guard, Snarl, etc.)
  let spreadAdded = 0;
  for (const cand of candidates) {
    if (spreadAdded >= quota.spreadMitigation) break;
    const moves: string[] = (cand.moves || []).map((m: any) => String(m).toLowerCase().replace(/[\s-_]/g, ''));
    const isSpreadMit = moves.some(m => ['wideguard', 'snarl', 'icywind', 'electroweb'].includes(m));
    if (isSpreadMit) {
      const key = getCandidateKey(cand);
      if (!selected.has(key)) {
        selected.set(key, cand);
        spreadAdded++;
      }
    }
  }

  // Completa até 40 se o total ainda for menor e houver candidatos na fonte
  for (const cand of candidates) {
    if (selected.size >= 40) break;
    const key = getCandidateKey(cand);
    if (!selected.has(key)) {
      selected.set(key, cand);
    }
  }

  return Array.from(selected.values());
}
