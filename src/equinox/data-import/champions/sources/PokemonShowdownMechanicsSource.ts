declare const require: (moduleName: string) => any;
const fs = require('fs') as any;
const path = require('path') as any;
import { ChampionsMechanicsSource } from './ChampionsSourceTypes';

interface SnapshotPayload {
  species?: unknown[];
  moves?: unknown[];
  abilities?: unknown[];
  items?: unknown[];
  learnsets?: unknown[];
}

export class PokemonShowdownMechanicsSource implements ChampionsMechanicsSource {
  public readonly sourceId = 'pokemon-showdown';
  public readonly sourceVersion: string;
  private readonly payload: SnapshotPayload;

  public constructor(snapshotPath: string, sourceVersion: string) {
    this.sourceVersion = sourceVersion;
    const absolutePath = path.resolve(snapshotPath);
    if (!fs.existsSync(absolutePath)) throw new Error('MECHANICS_SOURCE_UNAVAILABLE');
    this.payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as SnapshotPayload;
  }

  public async loadSpecies(): Promise<unknown[]> { return this.payload.species ?? []; }
  public async loadMoves(): Promise<unknown[]> { return this.payload.moves ?? []; }
  public async loadAbilities(): Promise<unknown[]> { return this.payload.abilities ?? []; }
  public async loadItems(): Promise<unknown[]> { return this.payload.items ?? []; }
  public async loadLearnsets(): Promise<unknown[]> { return this.payload.learnsets ?? []; }
}
