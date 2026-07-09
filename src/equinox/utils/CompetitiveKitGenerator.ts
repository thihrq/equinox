import { PokemonData } from '../core/AnalysisContext';
import { getVariant, getMegaStone } from './PokemonUtils';

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
    const variant = getVariant(pokemon, format);
    const stats = variant?.baseStats ?? { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 };
    const types = variant?.types ?? pokemon.types ?? [];

    // 1. Resolver Habilidade
    let ability = 'Blaze';
    if (variant?.abilities) {
      ability = variant.abilities.H || variant.abilities[0] || 'Intimidate';
    }

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
    if (moves.length < 3) {
      moves.push(isPhysical ? 'Double-Edge' : 'Hyper Voice');
    }
    moves.push('Protect');

    return {
      ability,
      item,
      moves: moves.slice(0, 4),
    };
  }
}
