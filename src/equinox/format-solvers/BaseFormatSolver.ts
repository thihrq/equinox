import { PokemonData } from '../core/AnalysisContext';
import { generateBasicKit, getMegaStone, getPokemonTypes, getVariant } from '../utils/PokemonUtils';
import { resolveLegalAbility } from '../utils/VgcSetOptimizer';
import { FormatSolver, SetSourceInput, DiversitySelectionOptions, FormatCandidateScoreParams, FormatTeamValidationResult } from './FormatSolver';
import type { CoverageRequirement } from '../recommendation/DiversityCandidateSelector';

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const ensureFourMoves = (moves: string[] | undefined, fallback: string[], includeProtect: boolean): string[] => {
  const resolved: string[] = [];
  for (const move of [...(moves ?? []), ...fallback]) {
    if (!move) continue;
    if (resolved.some(existing => normalize(existing) === normalize(move))) continue;
    resolved.push(move);
    if (resolved.length >= 4) break;
  }

  if (includeProtect && !resolved.some(move => normalize(move) === 'protect')) {
    if (resolved.length >= 4) resolved[resolved.length - 1] = 'Protect';
    else resolved.push('Protect');
  }

  return resolved.slice(0, 4);
};

export abstract class BaseFormatSolver implements FormatSolver {
  public abstract readonly mode: FormatSolver['mode'];
  public abstract readonly id: string;
  public abstract readonly label: string;
  public abstract readonly usesItemClause: boolean;
  public abstract readonly usesFourOfSixModes: boolean;
  public abstract readonly usesDoublesMechanicContracts: boolean;
  public abstract readonly usesSinglesFieldControlContracts: boolean;
  public abstract readonly usesBossGauntlet: boolean;

  public normalizePokemonSet(input: SetSourceInput): PokemonData {
    const { pokemon, format, savedSet, defaultKit, basicKit } = input;
    const generated = defaultKit ?? this.generateFormatNeutralKit(pokemon, format);
    const basic = basicKit ?? generateBasicKit(pokemon, format);
    const megaStone = getMegaStone(pokemon.name);
    const ability = resolveLegalAbility(pokemon, format, pokemon.ability || savedSet?.ability || generated.ability) || pokemon.ability || savedSet?.ability || generated.ability || 'Nenhum';
    const fallbackMoves = this.getFallbackMoves(pokemon, format);
    const moves = ensureFourMoves(
      pokemon.moves && pokemon.moves.length > 0 ? pokemon.moves : (savedSet?.moves ?? generated.moves),
      fallbackMoves,
      this.shouldForceProtect(),
    );

    return {
      ...pokemon,
      ability,
      item: megaStone ?? pokemon.item ?? savedSet?.item ?? generated.item,
      moves,
      nature: pokemon.nature ?? savedSet?.nature ?? basic.nature,
      role: pokemon.role ?? savedSet?.role ?? basic.role,
    };
  }

  protected generateFormatNeutralKit(pokemon: PokemonData, format: string): { ability?: string; item?: string; moves?: string[] } {
    const variant = getVariant(pokemon, format);
    const stats = variant?.baseStats;
    const speed = Number(stats?.spe ?? 80);
    const atk = Number(stats?.atk ?? 80);
    const spa = Number(stats?.spa ?? 80);
    const bulky = Number(stats?.hp ?? 80) >= 90 || Number(stats?.def ?? 80) >= 100 || Number(stats?.spd ?? 80) >= 100;
    const megaStone = getMegaStone(pokemon.name);
    const ability = resolveLegalAbility(pokemon, format, pokemon.ability) || pokemon.ability || 'Nenhum';
    const item = megaStone ?? (bulky ? 'Leftovers' : speed >= 95 ? 'Life Orb' : atk >= spa ? 'Clear Amulet' : 'Sitrus Berry');
    return {
      ability,
      item,
      moves: ensureFourMoves(undefined, this.getFallbackMoves(pokemon, format), this.shouldForceProtect()),
    };
  }

  public normalizeFinalTeam(team: PokemonData[], _format: string): PokemonData[] {
    return team;
  }

  public getDiversityOptions(): DiversitySelectionOptions {
    return {
      maxCandidates: 60,
      topOverall: 30,
      perRole: 8,
      perType: 3,
      minCandidates: 30,
    };
  }

  public getMandatoryMechanicCoverage(_baseTeam: PokemonData[], _format: string): CoverageRequirement[] {
    return [];
  }

  public adjustCandidateScore(_params: FormatCandidateScoreParams): number {
    return 0;
  }

  public validateFinalTeam(_team: PokemonData[], _format: string): FormatTeamValidationResult {
    return {
      valid: true,
      hardFailures: [],
      warnings: [],
    };
  }

  protected shouldForceProtect(): boolean {
    return false;
  }

  protected getFallbackMoves(pokemon: PokemonData, format: string): string[] {
    const variant = getVariant(pokemon, format);
    const stats = variant?.baseStats;
    const atk = Number(stats?.atk ?? 80);
    const spa = Number(stats?.spa ?? 80);
    const physical = atk > spa;
    const types = getPokemonTypes(pokemon, format).map(type => type.toLowerCase());
    const byType: Record<string, { physical: string; special: string }> = {
      fire: { physical: 'Flare Blitz', special: 'Flamethrower' },
      water: { physical: 'Liquidation', special: 'Surf' },
      grass: { physical: 'Seed Bomb', special: 'Energy Ball' },
      electric: { physical: 'Wild Charge', special: 'Thunderbolt' },
      ground: { physical: 'Earthquake', special: 'Earth Power' },
      rock: { physical: 'Rock Slide', special: 'Power Gem' },
      flying: { physical: 'Brave Bird', special: 'Air Slash' },
      dragon: { physical: 'Dragon Claw', special: 'Draco Meteor' },
      steel: { physical: 'Iron Head', special: 'Flash Cannon' },
      fairy: { physical: 'Play Rough', special: 'Moonblast' },
      fighting: { physical: 'Close Combat', special: 'Aura Sphere' },
      ghost: { physical: 'Shadow Claw', special: 'Shadow Ball' },
      dark: { physical: 'Knock Off', special: 'Dark Pulse' },
      psychic: { physical: 'Zen Headbutt', special: 'Psychic' },
      ice: { physical: 'Ice Spinner', special: 'Ice Beam' },
      poison: { physical: 'Poison Jab', special: 'Sludge Bomb' },
      bug: { physical: 'Leech Life', special: 'Bug Buzz' },
      normal: { physical: 'Body Slam', special: 'Hyper Voice' },
    };

    const stab = types
      .map(type => byType[type]?.[physical ? 'physical' : 'special'])
      .filter(Boolean) as string[];

    const utility = physical
      ? ['Rock Slide', 'High Horsepower', 'Knock Off', 'Protect']
      : ['Ice Beam', 'Thunderbolt', 'Earth Power', 'Protect'];

    return [...stab, ...utility];
  }
}
