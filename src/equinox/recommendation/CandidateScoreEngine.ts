import { TYPE_CHART } from '../../utils/TypeChart';
import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { RadicalRedGauntletScorer } from '../radicalred/RadicalRedGauntletScorer';
import { ChampionsRegulationScorer } from '../champions/ChampionsRegulationScorer';

export type TeamIdentity =
  | 'balanced'
  | 'bulky_offense'
  | 'hyper_offense'
  | 'stall'
  | 'speed'
  | 'fun';

export interface CandidateScoreResult {
  pokemon: PokemonData;
  score: number;
  roles: string[];
  types: string[];
  reasons: string[];
}

interface ScoreCandidatesParams {
  baseTeam: PokemonData[];
  candidates: PokemonData[];
  format: string;
  teamIdentity?: TeamIdentity;
}

export class CandidateScoreEngine {
  private readonly radicalRedScorer = new RadicalRedGauntletScorer();
  private readonly championsScorer = new ChampionsRegulationScorer();

  public scoreCandidates(params: ScoreCandidatesParams): CandidateScoreResult[] {
    const { baseTeam, candidates, format, teamIdentity = 'balanced' } = params;

    const baseTypes = this.getTeamTypes(baseTeam, format);
    const exposedWeaknesses = this.getExposedWeaknesses(baseTeam, format);

    return candidates
      .map(candidate =>
        this.scoreCandidate(candidate, baseTeam, baseTypes, exposedWeaknesses, format, teamIdentity),
      )
      .sort((a, b) => b.score - a.score);
  }

  private scoreCandidate(
    candidate: PokemonData,
    baseTeam: PokemonData[],
    baseTypes: Set<string>,
    exposedWeaknesses: string[],
    format: string,
    teamIdentity: TeamIdentity,
  ): CandidateScoreResult {
    const candidateTypes = getPokemonTypes(candidate, format);
    const roles = this.inferRoles(candidate, format);

    let score = 0;
    const reasons: string[] = [];

    for (const weaknessType of exposedWeaknesses) {
      const multiplier = getDamageMultiplier(candidateTypes, weaknessType);

      if (multiplier === 0) {
        score += 22;
        reasons.push(`Imune a ${weaknessType}`);
      } else if (multiplier <= 0.5) {
        score += 16;
        reasons.push(`Resiste a ${weaknessType}`);
      } else if (multiplier >= 2) {
        score -= 14;
        reasons.push(`Também é fraco a ${weaknessType}`);
      }
    }

    for (const type of candidateTypes) {
      if (!baseTypes.has(type)) {
        score += 8;
        reasons.push(`Adiciona novo tipo: ${type}`);
      } else {
        score -= 3;
      }
    }

    const variant = getVariant(candidate, format);
    const stats = variant?.baseStats;

    const hp = Number(stats?.hp ?? 0);
    const atk = Number(stats?.atk ?? 0);
    const def = Number(stats?.def ?? 0);
    const spa = Number(stats?.spa ?? 0);
    const spd = Number(stats?.spd ?? 0);
    const spe = Number(stats?.spe ?? 0);

    if (spe >= 110) {
      score += 12;
      reasons.push('Adiciona alta velocidade');
    } else if (spe >= 100) {
      score += 8;
      reasons.push('Adiciona boa velocidade');
    }

    for (const role of roles) {
      if (role !== 'Flex') {
        score += 6;
        reasons.push(`Adiciona função: ${role}`);
      }
    }

    const bst = this.calculateBST(candidate, format);

    if (bst >= 520) score += 6;
    if (bst < 470) score -= 8;

    const identityBonus = this.calculateIdentityBonus({
      teamIdentity,
      roles,
      hp,
      atk,
      def,
      spa,
      spd,
      spe,
      bst,
      candidateName: candidate.name,
      reasons,
    });

    score += identityBonus;

    if (this.radicalRedScorer.isApplicable(format)) {
      const gauntletFit = this.radicalRedScorer.scoreCandidate({
        baseTeam,
        candidate,
        format,
      });

      if (gauntletFit.score !== 0) {
        score += Math.round(gauntletFit.score * 1.65);
      }

      reasons.push(...gauntletFit.reasons);
    }

    if (this.championsScorer.isApplicable(format)) {
      const regulationFit = this.championsScorer.scoreCandidate({
        baseTeam,
        candidate,
        format,
      });

      if (regulationFit.score !== 0) {
        score += Math.round(regulationFit.score * 1.8);
      }

      reasons.push(...regulationFit.reasons);
    }

    return {
      pokemon: candidate,
      score,
      roles,
      types: candidateTypes,
      reasons,
    };
  }

  private calculateIdentityBonus(params: {
    teamIdentity: TeamIdentity;
    roles: string[];
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
    bst: number;
    candidateName: string;
    reasons: string[];
  }): number {
    const {
      teamIdentity,
      roles,
      hp,
      atk,
      def,
      spa,
      spd,
      spe,
      bst,
      candidateName,
      reasons,
    } = params;

    let bonus = 0;
    const isMega = candidateName.toLowerCase().includes('-mega');

    switch (teamIdentity) {
      case 'balanced': {
        if (roles.includes('Physical Wall') || roles.includes('Special Wall')) {
          bonus += 8;
          reasons.push('Combina com identidade Balance');
        }

        if (roles.includes('Pivot')) {
          bonus += 8;
          reasons.push('Ajuda a manter momentum em Balance');
        }

        if (spe >= 80 && spe <= 110) {
          bonus += 4;
        }

        break;
      }

      case 'bulky_offense': {
        if (hp >= 80 && (atk >= 100 || spa >= 100)) {
          bonus += 12;
          reasons.push('Combina com Bulky Offense');
        }

        if (roles.includes('Wallbreaker')) {
          bonus += 10;
          reasons.push('Pressiona bem em Bulky Offense');
        }

        if (def >= 80 || spd >= 80) {
          bonus += 5;
        }

        break;
      }

      case 'hyper_offense': {
        if (spe >= 100) {
          bonus += 14;
          reasons.push('Combina com Hyper Offense pela velocidade');
        }

        if (atk >= 115 || spa >= 115) {
          bonus += 14;
          reasons.push('Adiciona pressão ofensiva alta');
        }

        if (roles.includes('Wallbreaker')) {
          bonus += 8;
        }

        if (hp >= 100 && spe < 80) {
          bonus -= 8;
          reasons.push('Pode ser lento para Hyper Offense');
        }

        break;
      }

      case 'stall': {
        if (hp >= 90 && (def >= 100 || spd >= 100)) {
          bonus += 16;
          reasons.push('Combina com Stall por bulk defensivo');
        }

        if (roles.includes('Physical Wall') || roles.includes('Special Wall')) {
          bonus += 12;
        }

        if (atk >= 120 || spa >= 120) {
          bonus -= 5;
        }

        break;
      }

      case 'speed': {
        if (spe >= 120) {
          bonus += 18;
          reasons.push('Excelente para identidade focada em velocidade');
        } else if (spe >= 100) {
          bonus += 10;
          reasons.push('Bom encaixe para identidade focada em velocidade');
        }

        break;
      }

      case 'fun': {
        /**
         * Fun/Favorites deve preservar diversidade e identidade.
         * Aqui reduzimos domínio de picks óbvios sem torná-los proibidos.
         */
        if (isMega) {
          bonus -= 8;
          reasons.push('Penalidade leve para evitar excesso de Megas óbvios');
        }

        if (bst < 520) {
          bonus += 6;
          reasons.push('Favorece escolhas menos óbvias');
        }

        if (roles.includes('Flex')) {
          bonus += 4;
        }

        break;
      }
    }

    if (teamIdentity !== 'fun' && isMega) {
      bonus += 3;
    }

    return bonus;
  }

  private getExposedWeaknesses(team: PokemonData[], format: string): string[] {
    const exposed: string[] = [];

    for (const attackType of Object.keys(TYPE_CHART)) {
      const multipliers = team.map(pokemon =>
        getDamageMultiplier(getPokemonTypes(pokemon, format), attackType),
      );

      const maxMultiplier = Math.max(...multipliers);
      const minMultiplier = Math.min(...multipliers);

      if (maxMultiplier >= 2 && minMultiplier > 0.5) {
        exposed.push(attackType);
      }
    }

    return exposed;
  }

  private getTeamTypes(team: PokemonData[], format: string): Set<string> {
    const types = new Set<string>();

    for (const pokemon of team) {
      for (const type of getPokemonTypes(pokemon, format)) {
        types.add(type);
      }
    }

    return types;
  }

  private inferRoles(pokemon: PokemonData, format: string): string[] {
    if (pokemon.competitive?.roles?.length) {
      return pokemon.competitive.roles;
    }

    const stats = getVariant(pokemon, format)?.baseStats;

    if (!stats) return ['Flex'];

    const roles = new Set<string>();

    const hp = Number(stats.hp ?? 0);
    const atk = Number(stats.atk ?? 0);
    const def = Number(stats.def ?? 0);
    const spa = Number(stats.spa ?? 0);
    const spd = Number(stats.spd ?? 0);
    const spe = Number(stats.spe ?? 0);

    if (hp >= 80 && def >= 100) roles.add('Physical Wall');
    if (hp >= 80 && spd >= 100) roles.add('Special Wall');
    if (atk >= 110 || spa >= 110) roles.add('Wallbreaker');
    if (spe >= 100) roles.add('Speed Control');
    if (hp >= 80 && spe < 100 && (def >= 85 || spd >= 85)) roles.add('Pivot');

    if (pokemon.competitive?.utilityTags?.includes('Hazard Setter')) {
      roles.add('Hazard Setter');
    }

    if (pokemon.competitive?.utilityTags?.includes('Hazard Removal')) {
      roles.add('Hazard Removal');
    }

    if (roles.size === 0) roles.add('Flex');

    return [...roles];
  }

  private calculateBST(pokemon: PokemonData, format: string): number {
    const stats = getVariant(pokemon, format)?.baseStats;

    if (!stats) return 0;

    return (
      Number(stats.hp ?? 0) +
      Number(stats.atk ?? 0) +
      Number(stats.def ?? 0) +
      Number(stats.spa ?? 0) +
      Number(stats.spd ?? 0) +
      Number(stats.spe ?? 0)
    );
  }
}