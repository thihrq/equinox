import type { PokemonData } from '../core/AnalysisContext';

export class CandidateCapabilityIndex {
  private readonly byRole = new Map<string, PokemonData[]>();
  private readonly byMove = new Map<string, PokemonData[]>();
  private readonly byAbility = new Map<string, PokemonData[]>();

  constructor(candidates: readonly PokemonData[]) {
    for (const c of candidates) {
      if (c.role) {
        const roleKey = c.role.toLowerCase();
        const list = this.byRole.get(roleKey) ?? [];
        list.push(c);
        this.byRole.set(roleKey, list);
      }
      if (c.moves) {
        for (const m of c.moves) {
          const moveKey = m.toLowerCase();
          const list = this.byMove.get(moveKey) ?? [];
          list.push(c);
          this.byMove.set(moveKey, list);
        }
      }
      if (c.ability) {
        const abilityKey = c.ability.toLowerCase();
        const list = this.byAbility.get(abilityKey) ?? [];
        list.push(c);
        this.byAbility.set(abilityKey, list);
      }
    }
  }

  public findByCapability(capability: string): readonly PokemonData[] {
    const key = capability.toLowerCase();
    return this.byRole.get(key) ?? this.byMove.get(key) ?? this.byAbility.get(key) ?? [];
  }
}
