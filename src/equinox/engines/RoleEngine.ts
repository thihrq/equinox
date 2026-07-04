import { AnalysisContext, PokemonData } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { getVariant } from '../utils/PokemonUtils';

const REQUIRED_ROLES = [
  'Physical Wall',
  'Special Wall',
  'Hazard Setter',
  'Hazard Removal',
  'Pivot',
  'Speed Control',
  'Wallbreaker',
];

export class RoleEngine implements AnalysisEngine {
  public readonly name = 'RoleEngine';

  public execute(context: AnalysisContext): void {
    const detectedRoles: Record<string, number> = {};

    for (const pokemon of context.selectedPokemon) {
      const roles = this.inferRoles(pokemon, context.format);

      for (const role of roles) {
        detectedRoles[role] = (detectedRoles[role] ?? 0) + 1;
      }
    }

    const missingRoles = REQUIRED_ROLES.filter(role => !detectedRoles[role]);

    const duplicatedRoles = Object.entries(detectedRoles)
      .filter(([, count]) => count >= 3)
      .map(([role]) => role);

    const roleCoverageRatio =
      (REQUIRED_ROLES.length - missingRoles.length) / REQUIRED_ROLES.length;

    context.analysis.roles = {
      detectedRoles,
      missingRoles,
      duplicatedRoles,
      roleCoverageRatio,
    };

    context.score.roles = this.calculateRoleScore(
      context,
      detectedRoles,
      missingRoles,
      duplicatedRoles,
    );
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

    if (spe >= 100) {
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
    detectedRoles: Record<string, number>,
    missingRoles: string[],
    duplicatedRoles: string[],
  ): number {
    let score = 0;

    for (const role of REQUIRED_ROLES) {
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