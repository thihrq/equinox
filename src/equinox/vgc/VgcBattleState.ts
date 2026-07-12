import type { PokemonData } from '../core/AnalysisContext';

export interface VgcBattleState {
  selectedFour: string[];
  active: [string, string];
  backline: [string, string];
  reserves: string[];
  selectedPokemon: PokemonData[];
}

export function resolveBattleState(
  fullTeam: PokemonData[],
  selectedFour: string[],
  lead: string[],
): VgcBattleState {
  const selectedSet = new Set(selectedFour);
  const active = lead.filter(name => selectedSet.has(name)).slice(0, 2) as [string, string];
  const backline = selectedFour.filter(name => !active.includes(name)).slice(0, 2) as [string, string];
  const reserves = fullTeam.map(pokemon => pokemon.name).filter(name => !selectedSet.has(name));
  const selectedPokemon = fullTeam.filter(pokemon => selectedSet.has(pokemon.name));

  return { selectedFour: [...selectedFour], active, backline, reserves, selectedPokemon };
}
