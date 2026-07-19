import { AnalysisContext, PokemonData } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { getVariant } from '../utils/PokemonUtils';

const BASE_REQUIRED_ROLES = [
  'Physical Wall',
  'Special Wall',
  'Hazard Setter',
  'Hazard Removal',
  'Pivot',
  'Speed Control',
  'Wallbreaker',
];

const SPEED_CONTROL_MOVES = ['trick room', 'tailwind', 'thunder wave', 'icy wind', 'electroweb', 'sticky web'];

export class RoleEngine implements AnalysisEngine {
  public readonly name = 'RoleEngine';

  public execute(context: AnalysisContext): void {
    const requiredRoles = this.getRequiredRoles(context.format);
    const detectedRoles: Record<string, number> = {};

    for (const pokemon of context.selectedPokemon) {
      const roles = this.inferRoles(pokemon, context.format);

      for (const role of roles) {
        detectedRoles[role] = (detectedRoles[role] ?? 0) + 1;
      }
    }

    const missingRoles = requiredRoles.filter(role => !detectedRoles[role]);

    const duplicatedRoles = Object.entries(detectedRoles)
      .filter(([, count]) => count >= 3)
      .map(([role]) => role);

    const roleCoverageRatio =
      (requiredRoles.length - missingRoles.length) / requiredRoles.length;

    context.analysis.roles = {
      detectedRoles,
      missingRoles,
      duplicatedRoles,
      roleCoverageRatio,
    };

    context.score.roles = this.calculateRoleScore(
      context,
      requiredRoles,
      detectedRoles,
      missingRoles,
      duplicatedRoles,
    );
  }

  // Achado real 2026-07-18: REQUIRED_ROLES era uma lista fixa aplicada a
  // qualquer formato -- Hazard Setter/Hazard Removal são marginais em VGC
  // Doubles real (o controle de campo prioritário ali é Trick
  // Room/Tailwind/clima/terrain, não stacking de hazard como em Singles),
  // então times Doubles legítimos sempre perdiam pontuação por "função
  // ausente" em algo que não faz parte do plano de vitória do formato.
  private getRequiredRoles(format: string): string[] {
    if (format.endsWith('_doubles')) {
      return BASE_REQUIRED_ROLES.filter(role => role !== 'Hazard Setter' && role !== 'Hazard Removal');
    }

    return BASE_REQUIRED_ROLES;
  }

  private inferRoles(pokemon: PokemonData, format: string): string[] {
    if (pokemon.competitive?.roles?.length) {
      return pokemon.competitive.roles;
    }

    const variant = getVariant(pokemon, format);
    const stats = variant?.baseStats;

    if (!stats) return ['Flex'];

    const roles = new Set<string>();

    const hp = Number(stats.hp ?? 0);
    const atk = Number(stats.atk ?? 0);
    const def = Number(stats.def ?? 0);
    const spa = Number(stats.spa ?? 0);
    const spd = Number(stats.spd ?? 0);
    const spe = Number(stats.spe ?? 0);

    if (hp >= 80 && def >= 100) {
      roles.add('Physical Wall');
    }

    if (hp >= 80 && spd >= 100) {
      roles.add('Special Wall');
    }

    if (atk >= 110 || spa >= 110) {
      roles.add('Wallbreaker');
    }

    // Achado real 2026-07-18: só marcava "Speed Control" por Speed base
    // alta (>=100), então um setter de Trick Room genuíno (tipicamente
    // muito lento, é o oposto do padrão de time rápido) nunca contribuía
    // com esse role -- mesmo carregando o golpe de verdade no set final.
    const moveValues = (pokemon.moves ?? []).map(move => String(move).toLowerCase());
    const hasSpeedControlMove = moveValues.some(move => SPEED_CONTROL_MOVES.includes(move));

    if (spe >= 100 || hasSpeedControlMove) {
      roles.add('Speed Control');
    }

    if (hp >= 80 && spe < 100 && (def >= 85 || spd >= 85)) {
      roles.add('Pivot');
    }

    /**
     * Heurística inicial:
     * ainda não temos movesets estruturados no banco.
     * Quando tivermos dados de golpes, Hazard Setter / Hazard Removal
     * serão detectados por tags competitivas ou movimentos conhecidos.
     */
    if (pokemon.competitive?.utilityTags?.includes('Hazard Setter')) {
      roles.add('Hazard Setter');
    }

    if (pokemon.competitive?.utilityTags?.includes('Hazard Removal')) {
      roles.add('Hazard Removal');
    }

    if (roles.size === 0) {
      roles.add('Flex');
    }

    return [...roles];
  }

  private calculateRoleScore(
    context: AnalysisContext,
    requiredRoles: string[],
    detectedRoles: Record<string, number>,
    missingRoles: string[],
    duplicatedRoles: string[],
  ): number {
    let score = 0;

    for (const role of requiredRoles) {
      if (detectedRoles[role]) {
        score += 6;

        context.addExplanation({
          engine: this.name,
          reason: `Função essencial presente: ${role}`,
          value: +6,
          impact: 'positive',
        });
      }
    }

    for (const role of missingRoles) {
      score -= 8;

      context.addExplanation({
        engine: this.name,
        reason: `Função ausente: ${role}`,
        value: -8,
        impact: 'negative',
      });
    }

    for (const role of duplicatedRoles) {
      score -= 5;

      context.addExplanation({
        engine: this.name,
        reason: `Função repetida em excesso: ${role}`,
        value: -5,
        impact: 'negative',
      });
    }

    return score;
  }
}