import { PokemonType } from './TeamDefensiveProfile';

export type DefensiveCapability =
  | 'TYPE_RESISTANCE'
  | 'TYPE_IMMUNITY'
  | 'ABILITY_IMMUNITY'
  | 'SAFE_SWITCH_IN'
  | 'RESISTANT_REDIRECTION'
  | 'SPREAD_MOVE_MITIGATION'
  | 'DAMAGE_REDUCTION'
  | 'DEFENSIVE_PIVOT';

export type StrategicCapability =
  | 'OFFENSIVE_SYNERGY'
  | 'SPEED_CONTROL'
  | 'FAKE_OUT'
  | 'REDIRECTION'
  | 'INTIMIDATE'
  | 'WEATHER_SUPPORT'
  | 'TERRAIN_SUPPORT'
  | 'TRICK_ROOM_SUPPORT'
  | 'POSITIONING'
  | 'UTILITY_SUPPORT';

export interface CandidateCapability {
  capability: DefensiveCapability | StrategicCapability;
  attackType?: PokemonType;
  source: 'TYPE' | 'ABILITY' | 'MOVE' | 'ITEM' | 'ROLE' | 'SET_PROFILE';
  confidence: 'DIRECT' | 'CONTEXTUAL';
  appliesTo: 'SINGLE_TARGET' | 'SPREAD' | 'BOTH';
  evidence: readonly string[];
}

export interface CandidateCapabilityProfile {
  candidateId: string;
  species: string;
  setId: string;

  defensiveCapabilities: readonly CandidateCapability[];
  strategicCapabilities: readonly CandidateCapability[];

  diversityKeys: readonly string[];
}

const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

export function getDamageMultiplier(attackType: PokemonType, defenderTypes: readonly PokemonType[]): number {
  let multiplier = 1;
  const attackMap = TYPE_CHART[attackType] || {};
  for (const defType of defenderTypes) {
    if (defType in attackMap && attackMap[defType] !== undefined) {
      multiplier *= attackMap[defType]!;
    }
  }
  return multiplier;
}

export function createCapabilityDiversityKey(
  species: string,
  setId: string,
  capability: DefensiveCapability | StrategicCapability,
  attackType?: PokemonType,
  appliesTo: 'SINGLE_TARGET' | 'SPREAD' | 'BOTH' = 'BOTH',
): string {
  return [species, setId, capability, attackType ?? 'none', appliesTo].join(':');
}

export class CandidateCapabilityClassifier {
  classify(candidate: {
    candidateId: string;
    species: string;
    canonicalSpecies?: string;
    setId: string;
    types: readonly PokemonType[];
    item?: string;
    ability?: string;
    moves?: readonly string[];
    categories?: readonly string[];
  }): CandidateCapabilityProfile {
    const defensiveCaps: CandidateCapability[] = [];
    const strategicCaps: CandidateCapability[] = [];
    const diversityKeys: string[] = [];

    const canonicalSpecies = candidate.canonicalSpecies || candidate.species;
    const allTypes: PokemonType[] = [
      'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
      'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
      'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
    ];

    const moves = candidate.moves || [];
    const ability = candidate.ability || '';

    // 1. Defesas baseadas em tipos
    for (const atkType of allTypes) {
      const mult = getDamageMultiplier(atkType, candidate.types);

      if (mult === 0) {
        const cap: CandidateCapability = {
          capability: 'TYPE_IMMUNITY',
          attackType: atkType,
          source: 'TYPE',
          confidence: 'DIRECT',
          appliesTo: 'BOTH',
          evidence: [`Imunidade de tipo (${candidate.types.join('/')}) contra ${atkType}`],
        };
        defensiveCaps.push(cap);
        diversityKeys.push(createCapabilityDiversityKey(canonicalSpecies, candidate.setId, 'TYPE_IMMUNITY', atkType));
      } else if (mult < 1) {
        const cap: CandidateCapability = {
          capability: 'TYPE_RESISTANCE',
          attackType: atkType,
          source: 'TYPE',
          confidence: 'DIRECT',
          appliesTo: 'BOTH',
          evidence: [`Resistência de tipo multiplicador ${mult}x contra ${atkType}`],
        };
        defensiveCaps.push(cap);
        diversityKeys.push(createCapabilityDiversityKey(canonicalSpecies, candidate.setId, 'TYPE_RESISTANCE', atkType));
      }
    }

    // 2. Wide Guard -> SPREAD_MOVE_MITIGATION apenas
    if (moves.includes('Wide Guard')) {
      const cap: CandidateCapability = {
        capability: 'SPREAD_MOVE_MITIGATION',
        source: 'MOVE',
        confidence: 'DIRECT',
        appliesTo: 'SPREAD',
        evidence: ['Possui Wide Guard para mitigação de área'],
      };
      defensiveCaps.push(cap);
      diversityKeys.push(createCapabilityDiversityKey(canonicalSpecies, candidate.setId, 'SPREAD_MOVE_MITIGATION', undefined, 'SPREAD'));
    }

    // 3. Redirecionamento
    const hasRedirection = moves.includes('Follow Me') || moves.includes('Rage Powder');
    if (hasRedirection) {
      strategicCaps.push({
        capability: 'REDIRECTION',
        source: 'MOVE',
        confidence: 'DIRECT',
        appliesTo: 'SINGLE_TARGET',
        evidence: ['Possui movimento de redirecionamento'],
      });
      diversityKeys.push(createCapabilityDiversityKey(canonicalSpecies, candidate.setId, 'REDIRECTION', undefined, 'SINGLE_TARGET'));

      // Verificar se possui resistência para RESISTANT_REDIRECTION
      for (const atkType of allTypes) {
        if (getDamageMultiplier(atkType, candidate.types) < 1) {
          defensiveCaps.push({
            capability: 'RESISTANT_REDIRECTION',
            attackType: atkType,
            source: 'MOVE',
            confidence: 'CONTEXTUAL',
            appliesTo: 'SINGLE_TARGET',
            evidence: [`Redirecionamento resistente a ${atkType}`],
          });
          diversityKeys.push(createCapabilityDiversityKey(canonicalSpecies, candidate.setId, 'RESISTANT_REDIRECTION', atkType, 'SINGLE_TARGET'));
        }
      }
    }

    // 4. Intimidate -> DAMAGE_REDUCTION física
    if (ability === 'Intimidate') {
      strategicCaps.push({
        capability: 'INTIMIDATE',
        source: 'ABILITY',
        confidence: 'DIRECT',
        appliesTo: 'BOTH',
        evidence: ['Habilidade Intimidate'],
      });
      defensiveCaps.push({
        capability: 'DAMAGE_REDUCTION',
        source: 'ABILITY',
        confidence: 'CONTEXTUAL',
        appliesTo: 'BOTH',
        evidence: ['Intimidate reduz dano físico de área e alvo único'],
      });
      diversityKeys.push(createCapabilityDiversityKey(canonicalSpecies, candidate.setId, 'INTIMIDATE'));
    }

    // 5. Pivôs
    const pivotMoves = ['Parting Shot', 'U-turn', 'Volt Switch', 'Flip Turn', 'Chilly Reception'];
    const hasPivotMove = moves.some(m => pivotMoves.includes(m));
    if (hasPivotMove) {
      strategicCaps.push({
        capability: 'POSITIONING',
        source: 'MOVE',
        confidence: 'DIRECT',
        appliesTo: 'BOTH',
        evidence: ['Possui movimento de reposicionamento/pivot'],
      });
      defensiveCaps.push({
        capability: 'DEFENSIVE_PIVOT',
        source: 'MOVE',
        confidence: 'DIRECT',
        appliesTo: 'BOTH',
        evidence: ['Pivot defensivo para troca segura'],
      });
      diversityKeys.push(createCapabilityDiversityKey(canonicalSpecies, candidate.setId, 'DEFENSIVE_PIVOT'));
    }

    return {
      candidateId: candidate.candidateId,
      species: candidate.species,
      setId: candidate.setId,
      defensiveCapabilities: defensiveCaps,
      strategicCapabilities: strategicCaps,
      diversityKeys: Array.from(new Set(diversityKeys)),
    };
  }
}
