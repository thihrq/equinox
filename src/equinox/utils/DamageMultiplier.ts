// TODO: Implementar a classe/módulo DamageMultiplier.ts
import { TYPE_CHART } from '../../utils/TypeChart';

export function getDamageMultiplier(defTypes: string[], atkType: string): number {
  if (!defTypes || defTypes.length === 0) return 1;

  const chartAtkKeys = Object.keys(TYPE_CHART);
  const realAtkKey = chartAtkKeys.find(
    key => key.toLowerCase() === atkType.toLowerCase(),
  );

  if (!realAtkKey || !TYPE_CHART[realAtkKey]) return 1;

  const chartDefKeys = Object.keys(TYPE_CHART[realAtkKey]);

  return defTypes.reduce((multiplier, defType) => {
    const realDefKey = chartDefKeys.find(
      key => key.toLowerCase() === defType.toLowerCase(),
    );

    if (!realDefKey) return multiplier;

    const efficacy = TYPE_CHART[realAtkKey][realDefKey];

    return multiplier * (efficacy ?? 1);
  }, 1);
}