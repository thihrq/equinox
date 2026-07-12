import { promises as fs } from 'fs';
import { IPokemonSet, PokemonSet } from '../../models/PokemonSet';
import { assertMongoAccessAllowed, markMongoRead } from '../data-audit/DataAuditRuntime';
import { calculateSha256 } from '../data-audit/FileIntegrity';
import { CompetitiveSetValidationInput } from '../data-validation/CompetitiveValidationTypes';

export interface CompetitiveSetSourceLoadResult<TSet = CompetitiveSetValidationInput> {
  sets: TSet[];
  source: {
    type: 'file' | 'mongo';
    path?: string;
    label: string;
    recordCount: number;
    contentHash?: string;
  };
}

export interface CompetitiveSetSource<TSet = CompetitiveSetValidationInput> {
  loadSets(): Promise<CompetitiveSetSourceLoadResult<TSet>>;
}

export class FileSystemCompetitiveSetSource implements CompetitiveSetSource {
  public constructor(private readonly filePath: string, private readonly label = 'local competitive package') {}

  public async loadSets(): Promise<CompetitiveSetSourceLoadResult> {
    const content = await fs.readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(content) as { sets?: CompetitiveSetValidationInput[] } | CompetitiveSetValidationInput[];
    const sets = Array.isArray(parsed) ? parsed : parsed.sets ?? [];
    return {
      sets,
      source: {
        type: 'file',
        path: this.filePath,
        label: this.label,
        recordCount: sets.length,
        contentHash: await calculateSha256(this.filePath),
      },
    };
  }
}

export class MongoCompetitiveSetSource implements CompetitiveSetSource<IPokemonSet> {
  public async loadSets(): Promise<CompetitiveSetSourceLoadResult<IPokemonSet>> {
    assertMongoAccessAllowed('load competitive sets from MongoDB');
    const sets = await PokemonSet.find({ status: 'active' }).lean<IPokemonSet[]>().exec();
    markMongoRead(sets.length);
    return {
      sets,
      source: {
        type: 'mongo',
        label: 'MongoDB active pokemonsets',
        recordCount: sets.length,
      },
    };
  }
}
