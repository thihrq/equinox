// TODO: Implementar a classe/módulo DefensiveMatrixEngine.ts
import { TYPE_CHART } from '../../utils/TypeChart';
import { AnalysisContext } from '../core/AnalysisContext';
import { AnalysisEngine } from '../core/AnalysisEngine';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes } from '../utils/PokemonUtils';

export class DefensiveMatrixEngine implements AnalysisEngine {
  public readonly name = 'DefensiveMatrixEngine';

  public execute(context: AnalysisContext): void {
    const attackTypes = Object.keys(TYPE_CHART);

    context.analysis.defensiveMatrix = attackTypes.map(attackType => {
      const multipliers = context.selectedPokemon.map(pokemon =>
        getDamageMultiplier(getPokemonTypes(pokemon, context.format), attackType),
      );

      const maxMultiplier = Math.max(...multipliers);
      const minMultiplier = Math.min(...multipliers);

      return {
        type: attackType,
        maxMultiplier,
        minMultiplier,
        hasWeakness: maxMultiplier >= 2,
        hasFatalWeakness: maxMultiplier >= 4,
        hasReliableSwitchIn: minMultiplier <= 0.5,
      };
    });
  }
}