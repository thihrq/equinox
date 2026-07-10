import { PokemonData } from '../core/AnalysisContext';
import { getDamageMultiplier } from '../utils/DamageMultiplier';
import { getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { isMegaOption } from '../utils/VgcSetOptimizer';
import { EquinoxFormatMode } from './FormatSolver';
import { evaluateCandidateAgainstResolvedPlan, evaluateTeamAgainstResolvedPlan, resolveFormatPlan } from './FormatPlanResolver';

export interface FormatObjectiveParams {
  mode: EquinoxFormatMode;
  baseTeam: PokemonData[];
  candidate?: PokemonData;
  team?: PokemonData[];
  format: string;
}

export interface FormatObjectiveResult {
  score: number;
  hardFailures: string[];
  warnings: string[];
  reasons: string[];
}

type WeatherFamily = 'rain' | 'sun' | 'sand' | 'snow';

const normalize = (value?: string): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const hasAny = (values: string[], targets: string[]): boolean => {
  const wanted = targets.map(normalize);
  return values.some(value => wanted.includes(normalize(value)));
};

const WEATHER: Record<WeatherFamily, {
  setters: string[];
  abusers: string[];
  supportAbilities: string[];
  supportMoves: string[];
}> = {
  rain: {
    setters: ['Drizzle', 'Primordial Sea'],
    abusers: ['Swift Swim'],
    supportAbilities: ['Rain Dish', 'Dry Skin', 'Hydration'],
    supportMoves: ['Rain Dance', 'Muddy Water', 'Hurricane', 'Thunder', 'Icy Wind', 'Tailwind'],
  },
  sun: {
    setters: ['Drought', 'Desolate Land', 'Orichalcum Pulse'],
    abusers: ['Chlorophyll', 'Solar Power', 'Flower Gift', 'Harvest'],
    supportAbilities: ['Protosynthesis'],
    supportMoves: ['Sunny Day', 'Solar Beam', 'Solar Blade', 'Weather Ball', 'Heat Wave'],
  },
  sand: {
    setters: ['Sand Stream', 'Sand Spit'],
    abusers: ['Sand Rush', 'Sand Force'],
    supportAbilities: ['Overcoat', 'Sand Veil'],
    supportMoves: ['Sandstorm', 'Rock Slide'],
  },
  snow: {
    setters: ['Snow Warning'],
    abusers: ['Slush Rush'],
    supportAbilities: ['Ice Body', 'Snow Cloak'],
    supportMoves: ['Snowscape', 'Blizzard', 'Aurora Veil'],
  },
};

const TERRAIN_SETTER_ABILITIES = ['Electric Surge', 'Grassy Surge', 'Psychic Surge', 'Misty Surge', 'Hadron Engine'];
const SLEEP_MOVES = ['Spore', 'Sleep Powder', 'Yawn'];
const DOUBLES_CONTROL_MOVES = ['Fake Out', 'Taunt', 'Encore', 'Parting Shot', 'Will-O-Wisp', 'Thunder Wave', 'Quash', 'Helping Hand'];
const REDIRECTION_MOVES = ['Follow Me', 'Rage Powder', 'Ally Switch'];
const SINGLES_FIELD_CONTROL_MOVES = ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Defog', 'Rapid Spin', 'Mortal Spin', 'Tidy Up'];
const SINGLES_PIVOT_MOVES = ['U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot', 'Teleport'];


function mergeResults(...results: FormatObjectiveResult[]): FormatObjectiveResult {
  return results.reduce<FormatObjectiveResult>((merged, result) => ({
    score: merged.score + result.score,
    hardFailures: [...merged.hardFailures, ...result.hardFailures],
    warnings: [...merged.warnings, ...result.warnings],
    reasons: [...merged.reasons, ...result.reasons],
  }), { score: 0, hardFailures: [], warnings: [], reasons: [] });
}

function values(obj?: Record<string, string>): string[] {
  return Object.values(obj ?? {}).map(String);
}

function abilityValues(pokemon: PokemonData, format: string): string[] {
  return [pokemon.ability, ...values(getVariant(pokemon, format)?.abilities), ...values(pokemon.abilities)].filter(Boolean) as string[];
}

function moveValues(pokemon: PokemonData): string[] {
  return pokemon.moves ?? [];
}

function hasAbility(pokemon: PokemonData, format: string, abilities: string[]): boolean {
  return hasAny(abilityValues(pokemon, format), abilities);
}

function hasMove(pokemon: PokemonData, moves: string[]): boolean {
  return hasAny(moveValues(pokemon), moves);
}

function stats(pokemon: PokemonData, format: string) {
  return getVariant(pokemon, format)?.baseStats ?? {};
}

function baseSpeed(pokemon: PokemonData, format: string): number {
  return Number(stats(pokemon, format)?.spe ?? 80);
}

function offenseScore(pokemon: PokemonData, format: string): number {
  const s = stats(pokemon, format);
  return Math.max(Number(s?.atk ?? 80), Number(s?.spa ?? 80));
}

function hasWeatherSetter(pokemon: PokemonData, format: string, family: WeatherFamily): boolean {
  return hasAbility(pokemon, format, WEATHER[family].setters) || hasMove(pokemon, [weatherMove(family)]);
}

function hasPrimaryWeatherAbuser(pokemon: PokemonData, format: string, family: WeatherFamily): boolean {
  const roleText = `${pokemon.role ?? ''} ${(pokemon.competitive?.teamStyles ?? []).join(' ')} ${(pokemon.competitive?.roles ?? []).join(' ')}`;
  return hasAbility(pokemon, format, WEATHER[family].abusers) || new RegExp(`${family}_abuser|${WEATHER[family].abusers.join('|')}`, 'i').test(roleText);
}

function hasWeatherSupport(pokemon: PokemonData, format: string, family: WeatherFamily): boolean {
  return hasAbility(pokemon, format, WEATHER[family].supportAbilities) || hasMove(pokemon, WEATHER[family].supportMoves);
}

function weatherMove(family: WeatherFamily): string {
  return family === 'rain' ? 'Rain Dance' : family === 'sun' ? 'Sunny Day' : family === 'sand' ? 'Sandstorm' : 'Snowscape';
}

function detectWeatherPlan(team: PokemonData[], format: string): WeatherFamily | undefined {
  const families = (Object.keys(WEATHER) as WeatherFamily[])
    .map(family => ({
      family,
      setters: team.filter(pokemon => hasWeatherSetter(pokemon, format, family)).length,
      abusers: team.filter(pokemon => hasPrimaryWeatherAbuser(pokemon, format, family)).length,
      support: team.filter(pokemon => hasWeatherSupport(pokemon, format, family)).length,
    }))
    .filter(entry => entry.setters > 0 || entry.abusers > 0)
    .sort((a, b) => (b.setters * 3 + b.abusers * 2 + b.support) - (a.setters * 3 + a.abusers * 2 + a.support));

  return families[0]?.family;
}

function hasOpposingWeather(pokemon: PokemonData, format: string, family: WeatherFamily): boolean {
  return (Object.keys(WEATHER) as WeatherFamily[])
    .filter(other => other !== family)
    .some(other => hasWeatherSetter(pokemon, format, other) || hasPrimaryWeatherAbuser(pokemon, format, other));
}

function isTurnControl(pokemon: PokemonData): boolean {
  return hasMove(pokemon, DOUBLES_CONTROL_MOVES) || /fake out|turn control|pivot|support|prankster/i.test(`${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`);
}

function isRedirection(pokemon: PokemonData): boolean {
  return hasMove(pokemon, REDIRECTION_MOVES) || /redirection|friend guard|rage powder|follow me/i.test(`${pokemon.role ?? ''} ${(pokemon.competitive?.roles ?? []).join(' ')}`);
}

function isTerrainSetter(pokemon: PokemonData, format: string): boolean {
  return hasAbility(pokemon, format, TERRAIN_SETTER_ABILITIES);
}

function hasSleepPlan(team: PokemonData[]): boolean {
  return team.some(pokemon => hasMove(pokemon, SLEEP_MOVES));
}

function weatherObjectiveCandidateScore(mode: EquinoxFormatMode, baseTeam: PokemonData[], candidate: PokemonData, format: string): FormatObjectiveResult {
  const result: FormatObjectiveResult = { score: 0, hardFailures: [], warnings: [], reasons: [] };
  const family = detectWeatherPlan(baseTeam, format);
  if (!family) return result;

  if (hasOpposingWeather(candidate, format, family)) {
    const message = `Candidato cria conflito com o plano de ${family}.`;
    if (mode === 'champions_doubles' || mode === 'champions_singles') result.hardFailures.push(message);
    else result.warnings.push(message);
    result.score -= mode === 'vanilla' ? 60 : 180;
  }

  const primaryAbuser = hasPrimaryWeatherAbuser(candidate, format, family);
  const support = hasWeatherSupport(candidate, format, family);
  const setter = hasWeatherSetter(candidate, format, family);

  if (primaryAbuser) {
    result.score += mode === 'champions_doubles' ? 150 : mode === 'radical_red' ? 85 : 55;
    result.reasons.push(`Fecha slot de abuser primário de ${family}.`);
  } else if (support || setter) {
    result.score += mode === 'champions_doubles' ? 45 : 25;
    result.reasons.push(`Adiciona suporte compatível com ${family}.`);
  }

  if (family === 'rain') {
    const types = getPokemonTypes(candidate, format).map(normalize);
    if (types.includes('fire') && !isRedirection(candidate) && !isTurnControl(candidate)) {
      result.score -= 120;
      result.warnings.push('Fire-type ofensivo tende a perder valor em Rain quando não oferece suporte claro.');
    }

    if (isTerrainSetter(candidate, format) && mode === 'champions_doubles' && !primaryAbuser && !support) {
      result.score -= 85;
      result.warnings.push('Terrain setter sem função de Rain compete com slots críticos do arquétipo.');
    }
  }

  return result;
}

function validateWeatherTeam(mode: EquinoxFormatMode, baseTeam: PokemonData[], team: PokemonData[], format: string): FormatObjectiveResult {
  const result: FormatObjectiveResult = { score: 0, hardFailures: [], warnings: [], reasons: [] };
  const family = detectWeatherPlan(baseTeam, format);
  if (!family) return result;

  const setters = team.filter(pokemon => hasWeatherSetter(pokemon, format, family)).length;
  const abusers = team.filter(pokemon => hasPrimaryWeatherAbuser(pokemon, format, family)).length;
  const opposing = team.filter(pokemon => hasOpposingWeather(pokemon, format, family));

  if (setters < 1) result.hardFailures.push(`Plano de ${family} sem setter no time final.`);
  if ((mode === 'champions_doubles' || mode === 'champions_singles') && abusers < 1) {
    result.hardFailures.push(`Plano de ${family} sem abuser primário no time final.`);
  }
  if (mode === 'champions_doubles' && family === 'rain' && abusers < 2) {
    result.warnings.push('Rain Doubles com apenas um abuser primário fica dependente de um único modo.');
    result.score -= 90;
  }
  if (opposing.length) {
    result.hardFailures.push(`Time final mistura ${family} com clima/abuser conflitante: ${opposing.map(p => p.name).join(', ')}.`);
  }

  result.score += setters * 35 + abusers * 55;
  return result;
}

function evaluateDoublesCandidate(baseTeam: PokemonData[], candidate: PokemonData, format: string): FormatObjectiveResult {
  const result = weatherObjectiveCandidateScore('champions_doubles', baseTeam, candidate, format);

  if (isTurnControl(candidate)) result.score += 45;
  if (isRedirection(candidate)) result.score += 35;
  if (hasSleepPlan([...baseTeam, candidate]) && isTerrainSetter(candidate, format)) {
    result.score -= 120;
    result.warnings.push('Terrain que bloqueia sono enfraquece Spore/Sleep Powder/Yawn do plano.');
  }
  return result;
}

function evaluateSinglesCandidate(mode: 'champions_singles' | 'radical_red' | 'vanilla', baseTeam: PokemonData[], candidate: PokemonData, format: string): FormatObjectiveResult {
  const result = weatherObjectiveCandidateScore(mode, baseTeam, candidate, format);
  const team = [...baseTeam, candidate];
  const hasHazard = team.some(pokemon => hasMove(pokemon, ['Stealth Rock', 'Spikes', 'Toxic Spikes']));
  const hasRemoval = team.some(pokemon => hasMove(pokemon, ['Defog', 'Rapid Spin', 'Mortal Spin', 'Tidy Up']));
  const hasPivot = team.some(pokemon => hasMove(pokemon, SINGLES_PIVOT_MOVES));
  const fastOrPriority = baseSpeed(candidate, format) >= 100 || hasMove(candidate, ['Aqua Jet', 'Sucker Punch', 'Extreme Speed', 'Grassy Glide', 'Bullet Punch']);

  if (mode === 'champions_singles') {
    if (!hasHazard && hasMove(candidate, SINGLES_FIELD_CONTROL_MOVES)) result.score += 45;
    if (!hasRemoval && hasMove(candidate, SINGLES_FIELD_CONTROL_MOVES)) result.score += 45;
    if (hasPivot) result.score += 25;
    if (fastOrPriority) result.score += 25;
    if (offenseScore(candidate, format) >= 115) result.score += 22;
  }

  if (mode === 'radical_red') {
    if (fastOrPriority) result.score += 28;
    if (hasMove(candidate, ['Stealth Rock', 'Spikes', 'Rapid Spin', 'Defog'])) result.score += 35;
    if (offenseScore(candidate, format) >= 110) result.score += 18;
  }

  if (mode === 'vanilla') {
    const baseTypes = new Set(baseTeam.flatMap(pokemon => getPokemonTypes(pokemon, format).map(normalize)));
    const newTypes = getPokemonTypes(candidate, format).filter(type => !baseTypes.has(normalize(type))).length;
    result.score += newTypes * 18;
  }

  return result;
}

function validateCommonTeam(mode: EquinoxFormatMode, baseTeam: PokemonData[], team: PokemonData[], format: string): FormatObjectiveResult {
  const result = validateWeatherTeam(mode, baseTeam, team, format);
  const megaCount = team.filter(pokemon => isMegaOption(pokemon)).length;
  if ((mode === 'champions_doubles' || mode === 'champions_singles') && megaCount > 1) {
    result.hardFailures.push('Mais de uma opção Mega no time final.');
  }

  if ((mode === 'champions_doubles' || mode === 'champions_singles') && hasSleepPlan(team)) {
    const blockingTerrain = team.filter(pokemon => hasAbility(pokemon, format, ['Electric Surge', 'Misty Surge']));
    if (blockingTerrain.length) {
      result.hardFailures.push(`Terreno bloqueia o plano de sono: ${blockingTerrain.map(p => p.name).join(', ')}.`);
    }
  }

  return result;
}

export function evaluateFormatCandidateObjective(params: FormatObjectiveParams): FormatObjectiveResult {
  const candidate = params.candidate;
  if (!candidate) return { score: 0, hardFailures: [], warnings: [], reasons: [] };

  const plan = resolveFormatPlan(params.baseTeam, params.format, params.mode);
  const systemic = evaluateCandidateAgainstResolvedPlan({
    plan,
    baseTeam: params.baseTeam,
    candidate,
    format: params.format,
  });

  let specific: FormatObjectiveResult;
  switch (params.mode) {
    case 'champions_doubles':
      specific = evaluateDoublesCandidate(params.baseTeam, candidate, params.format);
      break;
    case 'champions_singles':
      specific = evaluateSinglesCandidate('champions_singles', params.baseTeam, candidate, params.format);
      break;
    case 'radical_red':
      specific = evaluateSinglesCandidate('radical_red', params.baseTeam, candidate, params.format);
      break;
    case 'vanilla':
    default:
      specific = evaluateSinglesCandidate('vanilla', params.baseTeam, candidate, params.format);
      break;
  }

  return mergeResults(systemic, specific);
}

export function evaluateFormatTeamObjective(params: FormatObjectiveParams): FormatObjectiveResult {
  const team = params.team ?? params.baseTeam;
  const plan = resolveFormatPlan(params.baseTeam, params.format, params.mode);
  const systemic = evaluateTeamAgainstResolvedPlan({
    plan,
    baseTeam: params.baseTeam,
    team,
    format: params.format,
  });
  return mergeResults(validateCommonTeam(params.mode, params.baseTeam, team, params.format), systemic);
}
