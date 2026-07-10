import { PokemonData } from '../core/AnalysisContext';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { EquinoxFormatMode } from './FormatSolver';

export type WeatherPlanFamily = 'rain' | 'sun' | 'sand' | 'snow';
export type SpeedPlanFamily = 'trick_room' | 'tailwind' | 'weather_speed' | 'standard';

export interface ResolvedFormatPlan {
  mode: EquinoxFormatMode;
  primaryWeather?: WeatherPlanFamily;
  weatherConfidence: number;
  speedPlan: SpeedPlanFamily;
  signals: string[];
}

export interface PlanCandidateAssessment {
  score: number;
  hardFailures: string[];
  warnings: string[];
  reasons: string[];
}

const normalize = (value?: string): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const includesNormalized = (values: string[], targets: string[]): boolean => {
  const wanted = new Set(targets.map(normalize));
  return values.some(value => wanted.has(normalize(value)));
};

const WEATHER: Record<WeatherPlanFamily, {
  label: string;
  setterAbilities: string[];
  setterMoves: string[];
  primaryAbuserAbilities: string[];
  compatibleAbilities: string[];
  supportMoves: string[];
}> = {
  rain: {
    label: 'Rain',
    setterAbilities: ['Drizzle', 'Primordial Sea'],
    setterMoves: ['Rain Dance'],
    primaryAbuserAbilities: ['Swift Swim'],
    compatibleAbilities: ['Rain Dish', 'Dry Skin', 'Hydration'],
    supportMoves: ['Muddy Water', 'Hurricane', 'Thunder', 'Tailwind', 'Icy Wind', 'Helping Hand', 'Wide Guard'],
  },
  sun: {
    label: 'Sun',
    setterAbilities: ['Drought', 'Desolate Land', 'Orichalcum Pulse'],
    setterMoves: ['Sunny Day'],
    primaryAbuserAbilities: ['Chlorophyll', 'Solar Power', 'Flower Gift', 'Harvest'],
    compatibleAbilities: ['Protosynthesis'],
    supportMoves: ['Heat Wave', 'Weather Ball', 'Solar Beam', 'Solar Blade', 'Tailwind', 'Helping Hand'],
  },
  sand: {
    label: 'Sand',
    setterAbilities: ['Sand Stream', 'Sand Spit'],
    setterMoves: ['Sandstorm'],
    primaryAbuserAbilities: ['Sand Rush', 'Sand Force'],
    compatibleAbilities: ['Sand Veil', 'Overcoat'],
    supportMoves: ['Rock Slide', 'Wide Guard'],
  },
  snow: {
    label: 'Snow',
    setterAbilities: ['Snow Warning'],
    setterMoves: ['Snowscape'],
    primaryAbuserAbilities: ['Slush Rush'],
    compatibleAbilities: ['Ice Body', 'Snow Cloak'],
    supportMoves: ['Blizzard', 'Aurora Veil', 'Icy Wind'],
  },
};

const TERRAIN_SETTER_ABILITIES = ['Electric Surge', 'Grassy Surge', 'Psychic Surge', 'Misty Surge', 'Hadron Engine'];
const SLEEP_MOVES = ['Spore', 'Sleep Powder', 'Yawn'];
const REDIRECTION_MOVES = ['Follow Me', 'Rage Powder', 'Ally Switch'];
const DOUBLES_TURN_CONTROL_MOVES = ['Fake Out', 'Taunt', 'Encore', 'Parting Shot', 'Will-O-Wisp', 'Thunder Wave', 'Quash', 'Helping Hand', 'Wide Guard'];
const PIVOT_MOVES = ['U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot', 'Teleport'];

function getAbilityValues(pokemon: PokemonData, format: string): string[] {
  const values = new Set<string>();
  if (pokemon.ability) values.add(String(pokemon.ability));

  const variantAbilities = getVariant(pokemon, format)?.abilities;
  if (variantAbilities) {
    Object.values(variantAbilities).forEach(ability => ability && values.add(String(ability)));
  }

  if (pokemon.abilities) {
    Object.values(pokemon.abilities).forEach(ability => ability && values.add(String(ability)));
  }

  return [...values];
}

function getMoveValues(pokemon: PokemonData): string[] {
  return pokemon.moves ?? [];
}

function hasAbility(pokemon: PokemonData, format: string, abilities: string[]): boolean {
  return includesNormalized(getAbilityValues(pokemon, format), abilities);
}

function hasMove(pokemon: PokemonData, moves: string[]): boolean {
  return includesNormalized(getMoveValues(pokemon), moves);
}

export function hasAutomaticWeatherSetterForPlan(pokemon: PokemonData, format: string, family: WeatherPlanFamily): boolean {
  return hasAbility(pokemon, format, WEATHER[family].setterAbilities);
}

export function hasManualWeatherMoveForPlan(pokemon: PokemonData, family: WeatherPlanFamily): boolean {
  return hasMove(pokemon, WEATHER[family].setterMoves);
}

export function hasWeatherSetterForPlan(pokemon: PokemonData, format: string, family: WeatherPlanFamily): boolean {
  return hasAutomaticWeatherSetterForPlan(pokemon, format, family) || hasManualWeatherMoveForPlan(pokemon, family);
}

export function hasPrimaryWeatherAbuserForPlan(pokemon: PokemonData, format: string, family: WeatherPlanFamily): boolean {
  const roleText = `${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')} ${(pokemon.competitive?.teamStyles ?? []).join(' ')}`;
  return hasAbility(pokemon, format, WEATHER[family].primaryAbuserAbilities) ||
    new RegExp(`${family}_abuser|${WEATHER[family].primaryAbuserAbilities.join('|')}`, 'i').test(roleText);
}

export function hasWeatherSupportForPlan(pokemon: PokemonData, format: string, family: WeatherPlanFamily): boolean {
  return hasAbility(pokemon, format, WEATHER[family].compatibleAbilities) ||
    hasMove(pokemon, WEATHER[family].supportMoves) ||
    new RegExp(`${family} support|${family} utility`, 'i').test(`${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`);
}

export function hasOpposingWeatherForPlan(pokemon: PokemonData, format: string, family: WeatherPlanFamily): boolean {
  return (Object.keys(WEATHER) as WeatherPlanFamily[])
    .filter(other => other !== family)
    .some(other => hasWeatherSetterForPlan(pokemon, format, other) || hasPrimaryWeatherAbuserForPlan(pokemon, format, other));
}

export function isTerrainSetterForPlan(pokemon: PokemonData, format: string): boolean {
  return hasAbility(pokemon, format, TERRAIN_SETTER_ABILITIES);
}

export function hasSleepPlanForTeam(team: PokemonData[]): boolean {
  return team.some(pokemon => hasMove(pokemon, SLEEP_MOVES));
}

export function isRedirectionForPlan(pokemon: PokemonData): boolean {
  const text = `${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`;
  return hasMove(pokemon, REDIRECTION_MOVES) || /redirection|follow me|rage powder|friend guard/i.test(text);
}

export function isTurnControlForPlan(pokemon: PokemonData): boolean {
  const text = `${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`;
  return hasMove(pokemon, DOUBLES_TURN_CONTROL_MOVES) || /fake out|prankster|turn control|support|pivot|intimidate/i.test(text);
}

export function isPivotForPlan(pokemon: PokemonData): boolean {
  return hasMove(pokemon, PIVOT_MOVES) || /pivot|regenerator|intimidate/i.test(`${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`);
}

export function getManualWeatherMoveForPlan(family: WeatherPlanFamily): string {
  return WEATHER[family].setterMoves[0];
}

export function isManualWeatherSupportCandidateForPlan(
  pokemon: PokemonData,
  format: string,
  family: WeatherPlanFamily,
): boolean {
  const abilities = getAbilityValues(pokemon, format).map(normalize);
  const hasPrankster = abilities.includes('prankster');
  if (!hasPrankster) return false;

  const speed = baseSpeedForPlan(pokemon, format);
  const offense = offenseForPlan(pokemon, format);
  const roleText = `${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')} ${(pokemon.competitive?.teamStyles ?? []).join(' ')}`;
  const moves = getMoveValues(pokemon).map(normalize);

  return speed <= 85 &&
    offense <= 95 &&
    (/support|disruption|turn control|screens|utility|prankster/i.test(roleText) ||
      moves.some(move => ['taunt', 'encore', 'willowisp', 'quash', 'reflect', 'lightscreen'].includes(move)));
}

export function baseSpeedForPlan(pokemon: PokemonData, format: string): number {
  return Number(getVariant(pokemon, format)?.baseStats?.spe ?? 80);
}

export function offenseForPlan(pokemon: PokemonData, format: string): number {
  const stats = getVariant(pokemon, format)?.baseStats;
  return Math.max(Number(stats?.atk ?? 80), Number(stats?.spa ?? 80));
}

export function countTypeMembersForPlan(team: PokemonData[], format: string, type?: string): number {
  if (!type) return 0;
  const target = normalize(type);
  return team.filter(pokemon => getPokemonTypes(pokemon, format).map(normalize).includes(target)).length;
}

export function resolveFormatPlan(baseTeam: PokemonData[], format: string, mode: EquinoxFormatMode): ResolvedFormatPlan {
  const signals: string[] = [];
  const weatherScores = (Object.keys(WEATHER) as WeatherPlanFamily[]).map(family => {
    const explicitSetters = baseTeam.filter(pokemon => hasWeatherSetterForPlan(pokemon, format, family)).length;
    const abusers = baseTeam.filter(pokemon => hasPrimaryWeatherAbuserForPlan(pokemon, format, family)).length;
    const manualSetters = baseTeam.filter(pokemon => isManualWeatherSupportCandidateForPlan(pokemon, format, family)).length;
    const support = baseTeam.filter(pokemon => hasWeatherSupportForPlan(pokemon, format, family)).length;

    // Weather may be explicit (Drizzle/Drought/etc.) or inferred from a committed
    // weather-speed abuser plus a manual weather setter candidate. This keeps
    // name-only inputs from losing their intended mechanic before set generation.
    const effectiveSetters = explicitSetters + (abusers > 0 ? manualSetters : 0);
    const score = explicitSetters * 120 + (abusers > 0 ? manualSetters * 95 : 0) + abusers * 85 + support * 16;

    return { family, setters: effectiveSetters, explicitSetters, manualSetters, abusers, support, score };
  }).sort((a, b) => b.score - a.score);

  const bestWeather = weatherScores[0];
  const primaryWeather = bestWeather && bestWeather.score >= 100 ? bestWeather.family : undefined;

  if (primaryWeather) {
    const details = bestWeather
      ? `setters=${bestWeather.setters}, explicit=${bestWeather.explicitSetters}, manual=${bestWeather.manualSetters}, abusers=${bestWeather.abusers}, support=${bestWeather.support}`
      : '';
    signals.push(`${WEATHER[primaryWeather].label} detectado por contrato de clima no core base (${details}).`);
  }

  const allMoves = baseTeam.flatMap(getMoveValues).map(normalize);
  const hasTrickRoom = allMoves.includes('trickroom') || baseTeam.some(pokemon => /trick room/i.test(`${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`));
  const hasTailwind = allMoves.includes('tailwind') || baseTeam.some(pokemon => /tailwind/i.test(`${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`));
  const weatherSpeed = primaryWeather && baseTeam.some(pokemon => hasPrimaryWeatherAbuserForPlan(pokemon, format, primaryWeather));

  let speedPlan: SpeedPlanFamily = 'standard';
  if (hasTrickRoom) speedPlan = 'trick_room';
  else if (hasTailwind) speedPlan = 'tailwind';
  else if (weatherSpeed) speedPlan = 'weather_speed';

  return {
    mode,
    primaryWeather,
    weatherConfidence: bestWeather?.score ?? 0,
    speedPlan,
    signals,
  };
}

export function evaluateCandidateAgainstResolvedPlan(params: {
  plan: ResolvedFormatPlan;
  baseTeam: PokemonData[];
  candidate: PokemonData;
  format: string;
}): PlanCandidateAssessment {
  const { plan, baseTeam, candidate, format } = params;
  const result: PlanCandidateAssessment = { score: 0, hardFailures: [], warnings: [], reasons: [] };
  const family = plan.primaryWeather;

  if (family) {
    const setter = hasWeatherSetterForPlan(candidate, format, family) || isManualWeatherSupportCandidateForPlan(candidate, format, family);
    const automaticSetter = hasAutomaticWeatherSetterForPlan(candidate, format, family);
    const primaryAbuser = hasPrimaryWeatherAbuserForPlan(candidate, format, family);
    const support = hasWeatherSupportForPlan(candidate, format, family);
    const redirection = isRedirectionForPlan(candidate);
    const turnControl = isTurnControlForPlan(candidate);
    const pivot = isPivotForPlan(candidate);
    const baseAutomaticSetters = baseTeam.filter(member => hasAutomaticWeatherSetterForPlan(member, format, family)).length;
    const basePrimaryAbusers = baseTeam.filter(member => hasPrimaryWeatherAbuserForPlan(member, format, family)).length;
    const baseWeatherTypeCount = countTypeMembersForPlan(baseTeam, format, family === 'rain' ? 'water' : family === 'sun' ? 'fire' : undefined);
    const candidateIsPrimaryWeatherType = family === 'rain'
      ? getPokemonTypes(candidate, format).map(normalize).includes('water')
      : family === 'sun'
        ? getPokemonTypes(candidate, format).map(normalize).includes('fire')
        : false;

    if (plan.mode === 'champions_doubles' && automaticSetter && baseAutomaticSetters >= 1) {
      result.hardFailures.push(`Candidato duplica setter automático de ${family}; prefira suporte manual, abuser ou controle de turno.`);
      result.score -= 900;
    }

    if (plan.mode === 'champions_doubles' && primaryAbuser && basePrimaryAbusers >= 2) {
      result.hardFailures.push(`Candidato adiciona abuser de ${family} além do limite funcional do arquétipo.`);
      result.score -= 650;
    }

    if (plan.mode === 'champions_doubles' && family === 'rain' && candidateIsPrimaryWeatherType && baseWeatherTypeCount >= 3) {
      result.hardFailures.push('Candidato aumenta excesso de Water-types no plano Rain; prefira cobertura, pivot ou suporte.');
      result.score -= 520;
    }

    if (hasOpposingWeatherForPlan(candidate, format, family)) {
      result.hardFailures.push(`Candidato cria conflito com o plano de ${family}.`);
      result.score -= 900;
    }

    if (primaryAbuser) {
      result.score += plan.mode === 'champions_doubles' ? 260 : plan.mode === 'champions_singles' ? 150 : plan.mode === 'radical_red' ? 115 : 45;
      result.reasons.push(`Preenche abuser primário de ${family}.`);
    } else if (setter || support) {
      result.score += plan.mode === 'champions_doubles' ? 105 : 55;
      result.reasons.push(`Adiciona suporte compatível com ${family}.`);
    } else if (plan.mode === 'champions_doubles' && (turnControl || redirection || pivot)) {
      result.score += 55;
      result.reasons.push(`Preenche suporte de turno sem quebrar ${family}.`);
    } else if (plan.mode === 'champions_doubles') {
      result.score -= 95;
      result.warnings.push(`Não fecha slot crítico do plano de ${family}.`);
    }

    const types = getPokemonTypes(candidate, format).map(normalize);
    if (family === 'rain' && types.includes('fire') && !redirection && !turnControl) {
      result.score -= 180;
      result.warnings.push('Fire-type ofensivo sem função de suporte perde valor em Rain.');
    }
  }

  if (plan.mode === 'champions_doubles') {
    if (hasSleepPlanForTeam([...baseTeam, candidate]) && isTerrainSetterForPlan(candidate, format) && hasAbility(candidate, format, ['Electric Surge', 'Misty Surge'])) {
      result.hardFailures.push('Terrain bloqueia plano de sono do time.');
      result.score -= 450;
    }
  }

  return result;
}

export function evaluateTeamAgainstResolvedPlan(params: {
  plan: ResolvedFormatPlan;
  baseTeam: PokemonData[];
  team: PokemonData[];
  format: string;
}): PlanCandidateAssessment {
  const { plan, baseTeam, team, format } = params;
  const result: PlanCandidateAssessment = { score: 0, hardFailures: [], warnings: [], reasons: [] };
  const family = plan.primaryWeather;

  if (!family) return result;

  const setters = team.filter(pokemon => hasWeatherSetterForPlan(pokemon, format, family) || isManualWeatherSupportCandidateForPlan(pokemon, format, family)).length;
  const automaticSetters = team.filter(pokemon => hasAutomaticWeatherSetterForPlan(pokemon, format, family)).length;
  const baseAutomaticSetters = baseTeam.filter(pokemon => hasAutomaticWeatherSetterForPlan(pokemon, format, family)).length;
  const manualSetters = team.filter(pokemon => !hasAutomaticWeatherSetterForPlan(pokemon, format, family) && (hasManualWeatherMoveForPlan(pokemon, family) || isManualWeatherSupportCandidateForPlan(pokemon, format, family))).length;
  const abusers = team.filter(pokemon => hasPrimaryWeatherAbuserForPlan(pokemon, format, family)).length;
  const baseAbusers = baseTeam.filter(pokemon => hasPrimaryWeatherAbuserForPlan(pokemon, format, family)).length;
  const opposing = team.filter(pokemon => hasOpposingWeatherForPlan(pokemon, format, family));
  const supports = team.filter(pokemon => hasWeatherSupportForPlan(pokemon, format, family) || isTurnControlForPlan(pokemon) || isRedirectionForPlan(pokemon)).length;

  if (setters < 1) result.hardFailures.push(`Plano de ${family} sem setter.`);
  if ((plan.mode === 'champions_doubles' || plan.mode === 'champions_singles') && abusers < 1) {
    result.hardFailures.push(`Plano de ${family} sem abuser primário.`);
  }
  if (plan.mode === 'champions_doubles' && automaticSetters > Math.max(1, baseAutomaticSetters)) {
    result.hardFailures.push(`Plano de ${family} adicionou setter automático redundante; preserve no máximo um setter automático e use suporte manual quando necessário.`);
  }
  if (plan.mode === 'champions_doubles' && baseAutomaticSetters >= 1 && automaticSetters > baseAutomaticSetters) {
    result.hardFailures.push(`Plano de ${family} já possui setter automático no core base; não adicione outro setter automático.`);
  }
  if (plan.mode === 'champions_doubles' && baseAutomaticSetters === 0 && automaticSetters === 0 && manualSetters < 1) {
    result.hardFailures.push(`Plano de ${family} precisa de setter automático ou suporte manual de clima.`);
  }
  if (plan.mode === 'champions_doubles' && family === 'rain' && abusers < 2) {
    result.warnings.push('Rain Doubles com apenas um abuser primário fica dependente de um único modo.');
    result.score -= 120;
  }
  if (plan.mode === 'champions_doubles' && abusers > Math.max(2, baseAbusers)) {
    result.hardFailures.push(`Plano de ${family} excede o limite funcional de abusers primários; use no máximo dois e complete com suporte/cobertura.`);
  }

  if (plan.mode === 'champions_doubles' && family === 'rain') {
    const baseWaterMembers = countTypeMembersForPlan(baseTeam, format, 'water');
    const waterMembers = countTypeMembersForPlan(team, format, 'water');
    const waterLimit = Math.max(3, baseWaterMembers);
    if (waterMembers > waterLimit) {
      result.hardFailures.push(`Rain com ${waterMembers} Water-types excede o limite funcional ${waterLimit}; complete com cobertura defensiva/ofensiva fora de Water.`);
    }
  }

  if (opposing.length) {
    result.hardFailures.push(`Time mistura ${family} com clima/abuser conflitante: ${opposing.map(p => p.name).join(', ')}.`);
  }

  result.score += setters * 40 + abusers * 90 + supports * 14;
  return result;
}
