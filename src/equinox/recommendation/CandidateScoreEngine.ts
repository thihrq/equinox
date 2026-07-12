import { TYPE_CHART } from '../../utils/TypeChart';
import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { RadicalRedGauntletScorer } from '../radicalred/RadicalRedGauntletScorer';
import { ChampionsRegulationScorer } from '../champions/ChampionsRegulationScorer';
import { hasLikelyTrickRoomCoreForVgc } from '../vgc/VgcTeamBuilding';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import type { FormatSolver } from '../format-solvers/FormatSolver';
import { FormatSolverRegistry } from '../format-solvers/FormatSolverRegistry';
import { evaluateFormatCandidateObjective } from '../format-solvers/FormatObjectiveGuards';
import { resolveFormatPlan } from '../format-solvers/FormatPlanResolver';

export type TeamIdentity =
  | 'balanced'
  | 'bulky_offense'
  | 'hyper_offense'
  | 'stall'
  | 'speed'
  | 'fun'
  | 'offensive'
  | 'defensive'
  | 'anti-meta'
  | 'anti_meta'
  | 'creative';

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
  formatSolver?: FormatSolver;
}

export class CandidateScoreEngine {
  private readonly radicalRedScorer = new RadicalRedGauntletScorer();
  private readonly championsScorer = new ChampionsRegulationScorer();
  private readonly solverRegistry = new FormatSolverRegistry();

  public scoreCandidates(params: ScoreCandidatesParams): CandidateScoreResult[] {
    const { baseTeam, candidates, format, teamIdentity = 'balanced' } = params;
    const formatSolver = params.formatSolver ?? this.solverRegistry.getSolver(format);

    const baseTypes = this.getTeamTypes(baseTeam, format);
    const exposedWeaknesses = this.getExposedWeaknesses(baseTeam, format);
    const lockedPlan = resolveFormatPlan(baseTeam, format, formatSolver.mode);

    return candidates
      .map(candidate => {
        try {
          const normalizedCandidate = formatSolver.normalizePokemonSet({
            pokemon: candidate,
            format,
            preferCurated: true,
            formatPlan: lockedPlan,
          });
          return this.scoreCandidate(normalizedCandidate, baseTeam, baseTypes, exposedWeaknesses, format, teamIdentity, formatSolver);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          console.warn(`[Equinox] CandidateScore skipped ${candidate.name}: ${reason}`);
          return {
            pokemon: candidate,
            score: -9999,
            roles: ['Invalid Candidate Set'],
            types: getPokemonTypes(candidate, format),
            reasons: ['Candidato ignorado porque o set/perfil competitivo falhou na validação sistêmica.'],
          } satisfies CandidateScoreResult;
        }
      })
      .filter(result => result.score > -9000)
      .sort((a, b) => b.score - a.score);
  }

  private scoreCandidate(
    candidate: PokemonData,
    baseTeam: PokemonData[],
    baseTypes: Set<string>,
    exposedWeaknesses: string[],
    format: string,
    teamIdentity: TeamIdentity,
    formatSolver: FormatSolver,
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

    const baseHasLikelyTrickRoomCore = formatSolver.usesDoublesMechanicContracts && hasLikelyTrickRoomCoreForVgc(baseTeam, format);

    if (!baseHasLikelyTrickRoomCore && spe >= 110) {
      score += 12;
      reasons.push('Adiciona alta velocidade');
    } else if (!baseHasLikelyTrickRoomCore && spe >= 100) {
      score += 8;
      reasons.push('Adiciona boa velocidade');
    } else if (baseHasLikelyTrickRoomCore && spe >= 90 && teamIdentity !== 'offensive' && teamIdentity !== 'creative') {
      score -= 12;
      reasons.push('Velocidade alta pode disputar o plano de Trick Room');
    }

    for (const role of roles) {
      if (role !== 'Flex') {
        score += 6;
        reasons.push(`Adiciona função: ${role}`);
      }
    }

    score += formatSolver.adjustCandidateScore({
      baseTeam,
      candidate,
      format,
      teamIdentity,
      currentScore: score,
      currentRoles: roles,
      reasons,
    });

    const objective = evaluateFormatCandidateObjective({
      mode: formatSolver.mode,
      baseTeam,
      candidate,
      format,
    });

    score += objective.score;
    if (objective.hardFailures.length) {
      score -= objective.hardFailures.length * 450;
      reasons.push(...objective.hardFailures.map(failure => `Bloqueio de formato: ${failure}`));
    }
    if (objective.warnings.length) {
      score -= objective.warnings.length * 35;
      reasons.push(...objective.warnings.slice(0, 2));
    }
    reasons.push(...objective.reasons.slice(0, 3));

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
      ability: candidate.ability || '',
      types: candidateTypes,
    });

    score += identityBonus;

    // Dedicated FormatSolvers own the format-specific scoring now.
    // Legacy broad scorers are intentionally not added here because they can
    // override slot/contract decisions and reintroduce cross-format leakage.

    if (baseTeam.some(pokemon => isMegaOption(pokemon)) && isMegaOption(candidate)) {
      score -= 80;
      reasons.push('Evita segunda opção Mega no mesmo time');
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
    ability: string;
    types: string[];
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
      ability,
      types,
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

      case 'offensive': {
        if (atk >= 110 || spa >= 110) {
          bonus += 15;
          reasons.push('Adiciona poder ofensivo bruto');
        }
        if (roles.includes('Wallbreaker')) {
          bonus += 12;
          reasons.push('Combina com postura ofensiva');
        }
        break;
      }

      case 'defensive': {
        if (hp >= 90 || def >= 95 || spd >= 95) {
          bonus += 15;
          reasons.push('Reforça a estrutura defensiva do time');
        }
        if (roles.includes('Support') || roles.includes('Pivot') || roles.includes('Special Wall') || roles.includes('Physical Wall')) {
          bonus += 12;
          reasons.push('Adiciona suporte utilitário ao time');
        }
        break;
      }

      case 'anti-meta':
      case 'anti_meta': {
        const abilityLower = (ability || '').toLowerCase();
        const hasAntiMetaFeature = ['inner focus', 'defiant', 'competitive', 'clear body', 'armor tail', 'ghost'].includes(abilityLower) ||
                                   types.some((t: string) => t.toLowerCase() === 'ghost');
        if (hasAntiMetaFeature) {
          bonus += 18;
          reasons.push('Possui recursos para quebrar jogadas comuns do meta');
        }
        break;
      }

      case 'creative': {
        const topMeta = ['incineroar', 'rillaboom', 'urshifu', 'flutter mane', 'amoonguss', 'pelipper', 'sinistcha', 'tornadus', 'chiyu', 'chienpao'];
        const isOffMeta = !topMeta.includes(candidateName.toLowerCase());
        if (isOffMeta) {
          bonus += 18;
          reasons.push('Escolha fora do meta-game convencional');
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
