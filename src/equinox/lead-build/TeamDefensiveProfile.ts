export const ALL_POKEMON_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
] as const;

export type PokemonType = (typeof ALL_POKEMON_TYPES)[number];

export interface DefensiveMitigationProfile {
  wideGuardAgainstSpread: boolean;
  resistantRedirection: boolean;
  damageReduction: boolean;
  speedControl: boolean;
  fakeOutPressure: boolean;
  priorityPressure: boolean;
}

export interface TeamDefensiveTypeProfile {
  attackType: PokemonType;

  weakTargets: number;          // Atacados recebendo > 1.0x (2.0x ou 4.0x)
  severeWeakTargets: number;    // Atacados recebendo 4.0x
  neutralTargets: number;       // Atacados recebendo 1.0x
  resistantTargets: number;     // Atacados recebendo < 1.0x (0.5x ou 0.25x)
  immuneTargets: number;        // Atacados recebendo 0.0x

  safeSwitchIns: number;        // Imunidades (0.0x) + Resistências ultra-fortes (0.25x)
  weightedExposure: number;     // Pontuação ponderada de exposição do time a esta tipagem

  defensiveAnswers: number;     // Resistências reais + Imunidades reais (sem mitigações táticas)
  tacticalMitigationScore: number;
  spreadMitigationScore: number;

  mitigation: DefensiveMitigationProfile;
}

export interface DefensiveExposureIssue {
  attackType: PokemonType;
  weakTargets: number;
  defensiveAnswers: number;
  safeSwitchIns: number;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  message: string;
}

export interface TeamDefensiveProfile {
  byType: Record<PokemonType, TeamDefensiveTypeProfile>;
  criticalExposures: DefensiveExposureIssue[];
  totalScore: number;
}

/**
 * Matriz estática de efetividade de tipos atacantes contra tipos defensores.
 * Retorna o multiplicador de dano básico (0.0, 0.5, 1.0, 2.0).
 */
export function getTypeMultiplier(attacker: PokemonType, defender: PokemonType): number {
  if (attacker === 'Normal') {
    if (defender === 'Rock' || defender === 'Steel') return 0.5;
    if (defender === 'Ghost') return 0.0;
    return 1.0;
  }
  if (attacker === 'Fire') {
    if (defender === 'Grass' || defender === 'Ice' || defender === 'Bug' || defender === 'Steel') return 2.0;
    if (defender === 'Fire' || defender === 'Water' || defender === 'Rock' || defender === 'Dragon') return 0.5;
    return 1.0;
  }
  if (attacker === 'Water') {
    if (defender === 'Fire' || defender === 'Ground' || defender === 'Rock') return 2.0;
    if (defender === 'Water' || defender === 'Grass' || defender === 'Dragon') return 0.5;
    return 1.0;
  }
  if (attacker === 'Electric') {
    if (defender === 'Water' || defender === 'Flying') return 2.0;
    if (defender === 'Electric' || defender === 'Grass' || defender === 'Dragon') return 0.5;
    if (defender === 'Ground') return 0.0;
    return 1.0;
  }
  if (attacker === 'Grass') {
    if (defender === 'Water' || defender === 'Ground' || defender === 'Rock') return 2.0;
    if (defender === 'Fire' || defender === 'Grass' || defender === 'Poison' || defender === 'Flying' || defender === 'Bug' || defender === 'Dragon' || defender === 'Steel') return 0.5;
    return 1.0;
  }
  if (attacker === 'Ice') {
    if (defender === 'Grass' || defender === 'Ground' || defender === 'Flying' || defender === 'Dragon') return 2.0;
    if (defender === 'Fire' || defender === 'Water' || defender === 'Ice' || defender === 'Steel') return 0.5;
    return 1.0;
  }
  if (attacker === 'Fighting') {
    if (defender === 'Normal' || defender === 'Ice' || defender === 'Rock' || defender === 'Dark' || defender === 'Steel') return 2.0;
    if (defender === 'Poison' || defender === 'Flying' || defender === 'Psychic' || defender === 'Bug' || defender === 'Fairy') return 0.5;
    if (defender === 'Ghost') return 0.0;
    return 1.0;
  }
  if (attacker === 'Poison') {
    if (defender === 'Grass' || defender === 'Fairy') return 2.0;
    if (defender === 'Poison' || defender === 'Ground' || defender === 'Rock' || defender === 'Ghost') return 0.5;
    if (defender === 'Steel') return 0.0;
    return 1.0;
  }
  if (attacker === 'Ground') {
    if (defender === 'Fire' || defender === 'Electric' || defender === 'Poison' || defender === 'Rock' || defender === 'Steel') return 2.0;
    if (defender === 'Grass' || defender === 'Bug') return 0.5;
    if (defender === 'Flying') return 0.0;
    return 1.0;
  }
  if (attacker === 'Flying') {
    if (defender === 'Grass' || defender === 'Fighting' || defender === 'Bug') return 2.0;
    if (defender === 'Electric' || defender === 'Rock' || defender === 'Steel') return 0.5;
    return 1.0;
  }
  if (attacker === 'Psychic') {
    if (defender === 'Fighting' || defender === 'Poison') return 2.0;
    if (defender === 'Psychic' || defender === 'Steel') return 0.5;
    if (defender === 'Dark') return 0.0;
    return 1.0;
  }
  if (attacker === 'Bug') {
    if (defender === 'Grass' || defender === 'Psychic' || defender === 'Dark') return 2.0;
    if (defender === 'Fire' || defender === 'Fighting' || defender === 'Poison' || defender === 'Flying' || defender === 'Ghost' || defender === 'Steel' || defender === 'Fairy') return 0.5;
    return 1.0;
  }
  if (attacker === 'Rock') {
    if (defender === 'Fire' || defender === 'Ice' || defender === 'Flying' || defender === 'Bug') return 2.0;
    if (defender === 'Fighting' || defender === 'Ground' || defender === 'Steel') return 0.5;
    return 1.0;
  }
  if (attacker === 'Ghost') {
    if (defender === 'Psychic' || defender === 'Ghost') return 2.0;
    if (defender === 'Dark') return 0.5;
    if (defender === 'Normal') return 0.0;
    return 1.0;
  }
  if (attacker === 'Dragon') {
    if (defender === 'Dragon') return 2.0;
    if (defender === 'Steel') return 0.5;
    if (defender === 'Fairy') return 0.0;
    return 1.0;
  }
  if (attacker === 'Dark') {
    if (defender === 'Psychic' || defender === 'Ghost') return 2.0;
    if (defender === 'Fighting' || defender === 'Dark' || defender === 'Fairy') return 0.5;
    return 1.0;
  }
  if (attacker === 'Steel') {
    if (defender === 'Ice' || defender === 'Rock' || defender === 'Fairy') return 2.0;
    if (defender === 'Fire' || defender === 'Water' || defender === 'Electric' || defender === 'Steel') return 0.5;
    return 1.0;
  }
  if (attacker === 'Fairy') {
    if (defender === 'Fighting' || defender === 'Dragon' || defender === 'Dark') return 2.0;
    if (defender === 'Fire' || defender === 'Poison' || defender === 'Steel') return 0.5;
    return 1.0;
  }
  return 1.0;
}

/**
 * Calcula o multiplicador de efetividade defensiva de um Pokémon (que pode ter 1 ou 2 tipos) contra um tipo atacante.
 */
export function calculatePokemonDefensiveMultiplier(
  attackType: PokemonType,
  defenderTypes: PokemonType[],
): number {
  if (!defenderTypes || defenderTypes.length === 0) return 1.0;
  let mult = 1.0;
  for (const defType of defenderTypes) {
    mult *= getTypeMultiplier(attackType, defType);
  }
  return mult;
}

/**
 * Calcula o perfil defensivo de um time completo de Pokémon contra os 18 tipos.
 */
export function calculateTeamDefensiveProfile(team: Array<{ types?: PokemonType[]; moves?: string[]; ability?: string; item?: string }>): TeamDefensiveProfile {
  const byType = {} as Record<PokemonType, TeamDefensiveTypeProfile>;
  const criticalExposures: DefensiveExposureIssue[] = [];

  // Mapeamento preliminar de mitigações do time
  const hasWideGuard = team.some(p => p.moves?.some(m => m.toLowerCase().replace(/[\s-_]/g, '') === 'wideguard'));
  const hasSpeedControl = team.some(p => p.moves?.some(m => ['tailwind', 'trickroom', 'icywind', 'electroweb'].includes(m.toLowerCase().replace(/[\s-_]/g, ''))));

  for (const attackType of ALL_POKEMON_TYPES) {
    let weakTargets = 0;
    let severeWeakTargets = 0;
    let neutralTargets = 0;
    let resistantTargets = 0;
    let immuneTargets = 0;
    let safeSwitchIns = 0;
    let totalMultiplierSum = 0;

    for (const member of team) {
      const types = member.types || ['Normal'];
      const mult = calculatePokemonDefensiveMultiplier(attackType, types);
      totalMultiplierSum += mult;

      if (mult >= 3.9) {
        severeWeakTargets += 1;
        weakTargets += 1;
      } else if (mult > 1.1) {
        weakTargets += 1;
      } else if (mult === 0.0) {
        immuneTargets += 1;
        safeSwitchIns += 1;
      } else if (mult <= 0.26) {
        resistantTargets += 1;
        safeSwitchIns += 1;
      } else if (mult < 0.9) {
        resistantTargets += 1;
      } else {
        neutralTargets += 1;
      }
    }

    const defensiveAnswers = resistantTargets + immuneTargets;

    // Tática e Spread mitigation
    const isSpreadAttackType = ['Ice', 'Rock', 'Ground', 'Water', 'Fire', 'Fairy', 'Psychic', 'Electric'].includes(attackType);
    const spreadMitigationScore = (isSpreadAttackType && hasWideGuard) ? 15 : 0;
    const tacticalMitigationScore = hasSpeedControl ? 10 : 0;

    // Exposição ponderada
    const weightedExposure = (weakTargets * 25 + severeWeakTargets * 15) - (resistantTargets * 15 + immuneTargets * 25);

    const mitigationProfile: DefensiveMitigationProfile = {
      wideGuardAgainstSpread: isSpreadAttackType && hasWideGuard,
      resistantRedirection: false,
      damageReduction: false,
      speedControl: hasSpeedControl,
      fakeOutPressure: team.some(p => p.moves?.some(m => m.toLowerCase().replace(/[\s-_]/g, '') === 'fakeout')),
      priorityPressure: false,
    };

    byType[attackType] = {
      attackType,
      weakTargets,
      severeWeakTargets,
      neutralTargets,
      resistantTargets,
      immuneTargets,
      safeSwitchIns,
      weightedExposure,
      defensiveAnswers,
      tacticalMitigationScore,
      spreadMitigationScore,
      mitigation: mitigationProfile,
    };

    // Identificação de fraquezas acumuladas sem resposta
    const uncovered = Math.max(0, weakTargets - defensiveAnswers);
    if (weakTargets >= 4 && defensiveAnswers === 0) {
      criticalExposures.push({
        attackType,
        weakTargets,
        defensiveAnswers,
        safeSwitchIns,
        severity: 'CRITICAL',
        message: `Exposição defensiva crítica não compensada a ${attackType}: ${weakTargets} fraquezas e 0 respostas defensivas (resistências ou imunidades).`,
      });
    } else if (uncovered >= 3) {
      criticalExposures.push({
        attackType,
        weakTargets,
        defensiveAnswers,
        safeSwitchIns,
        severity: 'HIGH',
        message: `Alta vulnerabilidade acumulada a ${attackType}: ${weakTargets} fraquezas com apenas ${defensiveAnswers} resposta(s).`,
      });
    }
  }

  // Pontuação defensiva global do time (base 100 com penalidades)
  let totalScore = 100;
  for (const issue of criticalExposures) {
    if (issue.severity === 'CRITICAL') totalScore -= 30;
    else if (issue.severity === 'HIGH') totalScore -= 15;
  }

  return {
    byType,
    criticalExposures,
    totalScore: Math.max(0, totalScore),
  };
}
