import {
  AnalysisContext,
  PokemonData,
  SpeedMemberAnalysis,
  SpeedAnalysis,
} from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { getVariant } from '../utils/PokemonUtils';

const SPEED_CONTROL_MOVES = [
  'trick room',
  'tailwind',
  'thunder wave',
  'icy wind',
  'electroweb',
  'sticky web',
];

export class SpeedEngine implements AnalysisEngine {
  public readonly name = 'SpeedEngine';

  public execute(context: AnalysisContext): void {
    const members = context.selectedPokemon.map(pokemon =>
      this.analyzeMember(pokemon, context.format),
    );

    const totalSpeed = members.reduce((sum, member) => sum + member.baseSpeed, 0);
    const averageBaseSpeed = members.length > 0 ? totalSpeed / members.length : 0;

    const fastestPokemon = [...members].sort((a, b) => b.baseSpeed - a.baseSpeed)[0];
    const slowestPokemon = [...members].sort((a, b) => a.baseSpeed - b.baseSpeed)[0];

    const fastCount = members.filter(member => member.baseSpeed >= 100).length;
    const veryFastCount = members.filter(member => member.baseSpeed >= 120).length;
    const slowCount = members.filter(member => member.baseSpeed < 70).length;

    const hasSpeedControl = this.detectSpeedControl(context, members);

    const speedProfile = this.getSpeedProfile(
      averageBaseSpeed,
      fastCount,
      veryFastCount,
      slowCount,
    );

    const analysis: SpeedAnalysis = {
      members,
      averageBaseSpeed,
      fastestPokemon,
      slowestPokemon,
      fastCount,
      veryFastCount,
      slowCount,
      hasSpeedControl,
      speedProfile,
    };

    context.analysis.speed = analysis;
    context.score.speed = this.calculateSpeedScore(context, analysis);
  }

  private analyzeMember(
    pokemon: PokemonData,
    format: string,
  ): SpeedMemberAnalysis {
    const variant = getVariant(pokemon, format);
    const baseSpeed = Number(variant?.baseStats?.spe ?? 0);

    return {
      name: pokemon.name,
      baseSpeed,
      tier: this.getSpeedTier(baseSpeed),
    };
  }

  private getSpeedTier(
    baseSpeed: number,
  ): SpeedMemberAnalysis['tier'] {
    if (baseSpeed >= 120) return 'Very Fast';
    if (baseSpeed >= 100) return 'Fast';
    if (baseSpeed >= 80) return 'Medium';
    if (baseSpeed >= 60) return 'Slow';
    return 'Very Slow';
  }

  private detectSpeedControl(
    context: AnalysisContext,
    members: SpeedMemberAnalysis[],
  ): boolean {
    const hasNaturallyFastPokemon = members.some(member => member.baseSpeed >= 110);

    const hasSpeedTag = context.selectedPokemon.some(pokemon => {
      const tags = [
        ...(pokemon.competitive?.utilityTags ?? []),
        ...(pokemon.competitive?.offensiveTags ?? []),
      ];

      return tags.some(tag =>
        [
          'Speed Control',
          'Choice Scarf',
          'Priority',
          'Tailwind',
          'Trick Room',
          'Thunder Wave',
          'Icy Wind',
          'Sticky Web',
        ].includes(tag),
      );
    });

    // Achado real 2026-07-18: a checagem de tag acima só olha
    // pokemon.competitive.utilityTags/offensiveTags -- que nem sempre
    // carrega 'Trick Room' mesmo quando o set gerado tem o golpe de
    // verdade (ex.: Slowbro-Mega com Trick Room no moveset final
    // reportava hasSpeedControl=false). Checar o array de moves real
    // fecha esse ponto cego sem depender do dado de tag estar completo.
    const hasSpeedControlMove = context.selectedPokemon.some(pokemon =>
      this.hasSpeedControlMoveInSet(pokemon),
    );

    return hasNaturallyFastPokemon || hasSpeedTag || hasSpeedControlMove;
  }

  private hasSpeedControlMoveInSet(pokemon: PokemonData): boolean {
    return (pokemon.moves ?? []).some(move =>
      SPEED_CONTROL_MOVES.includes(String(move).toLowerCase()),
    );
  }

  private getSpeedProfile(
    averageBaseSpeed: number,
    fastCount: number,
    veryFastCount: number,
    slowCount: number,
  ): SpeedAnalysis['speedProfile'] {
    if (veryFastCount >= 2 || averageBaseSpeed >= 105) return 'Very Fast';
    if (fastCount >= 2 || averageBaseSpeed >= 90) return 'Fast';
    if (slowCount >= 4 || averageBaseSpeed < 65) return 'Very Slow';
    if (slowCount >= 3 || averageBaseSpeed < 75) return 'Slow';
    return 'Balanced';
  }

  private calculateSpeedScore(
    context: AnalysisContext,
    analysis: SpeedAnalysis,
  ): number {
    let score = 0;

    if (analysis.hasSpeedControl) {
      score += 12;

      context.addExplanation({
        engine: this.name,
        reason: 'Time possui controle de velocidade',
        value: +12,
        impact: 'positive',
      });
    } else {
      score -= 12;

      context.addExplanation({
        engine: this.name,
        reason: 'Time não possui controle de velocidade claro',
        value: -12,
        impact: 'negative',
      });
    }

    if (analysis.fastCount >= 2) {
      score += 8;

      context.addExplanation({
        engine: this.name,
        reason: 'Time possui múltiplos Pokémon rápidos',
        value: +8,
        impact: 'positive',
      });
    }

    if (analysis.veryFastCount >= 1) {
      score += 5;

      context.addExplanation({
        engine: this.name,
        reason: 'Time possui ao menos um Pokémon muito rápido',
        value: +5,
        impact: 'positive',
      });
    }

    if (analysis.slowCount >= 4 && !this.hasTrickRoomTag(context)) {
      score -= 10;

      context.addExplanation({
        engine: this.name,
        reason: 'Time é lento demais sem indicação de Trick Room',
        value: -10,
        impact: 'negative',
      });
    }

    if (analysis.averageBaseSpeed >= 85 && analysis.averageBaseSpeed <= 105) {
      score += 4;

      context.addExplanation({
        engine: this.name,
        reason: 'Velocidade média equilibrada para times balanceados',
        value: +4,
        impact: 'positive',
      });
    }

    return score;
  }

  private hasTrickRoomTag(context: AnalysisContext): boolean {
    return context.selectedPokemon.some(
      pokemon =>
        pokemon.competitive?.utilityTags?.includes('Trick Room') ||
        (pokemon.moves ?? []).some(move => String(move).toLowerCase() === 'trick room'),
    );
  }
}