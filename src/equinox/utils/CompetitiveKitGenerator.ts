import { Dex } from '@pkmn/dex';
import { PokemonData } from '../core/AnalysisContext';
import { getMegaBaseName, getMegaStone, getVariant } from './PokemonUtils';
import { getCuratedVgcSet, resolveLegalAbility } from './VgcSetOptimizer';

export class CompetitiveKitGenerator {
  private static TYPE_MOVES: Record<string, string[]> = {
    fire: ['Heat Wave', 'Flamethrower', 'Overheat'],
    water: ['Scald', 'Hydro Pump', 'Surf'],
    grass: ['Giga Drain', 'Energy Ball', 'Leaf Storm'],
    electric: ['Thunderbolt', 'Volt Switch', 'Thunder Wave'],
    ground: ['Earthquake', 'Earth Power', 'Stomping Tantrum'],
    rock: ['Rock Slide', 'Stone Edge', 'Power Gem'],
    flying: ['Hurricane', 'Air Slash', 'Brave Bird'],
    dragon: ['Draco Meteor', 'Dragon Claw', 'Dragon Pulse'],
    steel: ['Flash Cannon', 'Iron Head', 'Heavy Slam'],
    fairy: ['Moonblast', 'Dazzling Gleam', 'Play Rough'],
    fighting: ['Close Combat', 'Aura Sphere', 'Drain Punch'],
    normal: ['Double-Edge', 'Hyper Voice', 'Fake Out'],
    ghost: ['Shadow Ball', 'Shadow Claw', 'Poltergeist'],
    dark: ['Dark Pulse', 'Crunch', 'Knock Off'],
    psychic: ['Psychic', 'Psyshock', 'Zen Headbutt'],
    ice: ['Ice Beam', 'Blizzard', 'Icicle Crash'],
    poison: ['Sludge Bomb', 'Gunk Shot', 'Sludge Wave'],
    bug: ['Bug Buzz', 'U-turn', 'Lunge']
  };

  public static generate(pokemon: PokemonData, format: string) {
    const curated = getCuratedVgcSet(pokemon.name);
    if (curated) {
      return {
        ability: curated.ability,
        item: getMegaStone(pokemon.name) ?? curated.item,
        moves: curated.moves,
      };
    }

    const variant = getVariant(pokemon, format);
    const stats = variant?.baseStats ?? { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
    const types = variant?.types ?? pokemon.types ?? [];

    // 1. Resolver habilidade sem fallback fixo. O fallback antigo era 'Blaze',
    // o que gerava sets impossíveis em Pokémon sem set salvo no banco
    // (ex: Tapu-Koko com Blaze).
    const ability = this.resolveAbility(pokemon, format);

    // 2. Resolver Item — Mega Pokémon DEVEM segurar sua Mega Stone
    const isFast = Number(stats.spe) >= 95;
    const isPhysical = Number(stats.atk) > Number(stats.spa);
    const isSpecial = Number(stats.spa) >= Number(stats.atk);
    const isBulky = Number(stats.hp) >= 80 && (Number(stats.def) >= 95 || Number(stats.spd) >= 95);

    const megaStone = getMegaStone(pokemon.name);
    let item = megaStone ?? 'Sitrus Berry';
    if (!megaStone) {
      if (isFast) {
        item = 'Life Orb';
      } else if (isBulky) {
        item = 'Leftovers';
      } else if (isPhysical && Number(stats.atk) >= 110) {
        item = 'Choice Band';
      } else if (isSpecial && Number(stats.spa) >= 110) {
        item = 'Choice Specs';
      }
    }

    // 3. Resolver Golpes com base nos Tipos + Protect
    const moves: string[] = [];
    for (const t of types) {
      const typeKey = t.toLowerCase();
      const possibleMoves = this.TYPE_MOVES[typeKey] ?? [];
      if (possibleMoves.length > 0) {
        if (isPhysical) {
          const physMove = possibleMoves.find(m =>
            m === 'Earthquake' || m === 'Dragon Claw' || m === 'Iron Head' || m === 'Play Rough' ||
            m === 'Close Combat' || m === 'Brave Bird' || m === 'Crunch' || m === 'Zen Headbutt' ||
            m === 'Icicle Crash' || m === 'Gunk Shot' || m === 'Fake Out'
          );
          moves.push(physMove || possibleMoves[0]);
        } else {
          moves.push(possibleMoves[0]);
        }
      }
    }
    const fallbackMoves = isPhysical
      ? ['Double-Edge', 'Rock Slide', 'Knock Off']
      : ['Hyper Voice', 'Dazzling Gleam', 'Icy Wind'];

    for (const move of fallbackMoves) {
      if (moves.length >= 3) break;
      if (!moves.includes(move)) moves.push(move);
    }

    if (!moves.includes('Protect')) moves.push('Protect');

    return {
      ability,
      item,
      moves: [...new Set(moves)].slice(0, 4),
    };
  }

  private static resolveAbility(pokemon: PokemonData, format: string): string {
    const fromPokemon = resolveLegalAbility(pokemon, format, pokemon.ability);
    if (fromPokemon && fromPokemon !== 'Nenhum') return fromPokemon;

    const species = Dex.species.get(pokemon.name);
    if (species.exists && species.abilities) {
      return String(species.abilities.H ?? species.abilities['1'] ?? species.abilities['0']);
    }

    const baseSpecies = Dex.species.get(getMegaBaseName(pokemon.name));
    if (baseSpecies.exists && baseSpecies.abilities) {
      return String(baseSpecies.abilities.H ?? baseSpecies.abilities['1'] ?? baseSpecies.abilities['0']);
    }

    return 'Nenhum';
  }
}

