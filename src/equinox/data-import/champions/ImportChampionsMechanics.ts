import { FieldEvidence } from '../../data-packs/champions/ChampionsPackageTypes';

export interface MechanicsSnapshot {
  species: unknown[];
  moves: unknown[];
  abilities: unknown[];
  items: unknown[];
  learnsets: unknown[];
  evidence: FieldEvidence[];
}

export function importChampionsMechanics(input: unknown, evidence: FieldEvidence[]): MechanicsSnapshot {
  const snapshot = input as Partial<MechanicsSnapshot>;
  if (!Array.isArray(snapshot.species) || !Array.isArray(snapshot.moves) || !Array.isArray(snapshot.abilities)
    || !Array.isArray(snapshot.items) || !Array.isArray(snapshot.learnsets)) {
    throw new Error('mechanics snapshot must contain species, moves, abilities, items and learnsets arrays');
  }
  return { ...snapshot, evidence } as MechanicsSnapshot;
}
