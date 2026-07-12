import { IPokemonSet, PokemonSet } from '../../models/PokemonSet';
import { assertMongoAccessAllowed, markMongoRead } from '../data-audit/DataAuditRuntime';

export interface CompetitiveSetQuery {
  pokemonId?: string;
  formId?: string;
  regulationId: string;
  battleStyle: 'singles' | 'doubles';
  legal: true;
  status: 'active';
  minimumConfidence: number;
  requiredRole?: string;
  archetype?: string;
}

export class CompetitiveSetRepository {
  public async findSets(query: CompetitiveSetQuery): Promise<IPokemonSet[]> {
    assertMongoAccessAllowed('CompetitiveSetRepository.findSets');
    const mongoQuery: Record<string, unknown> = {
      regulationId: query.regulationId,
      battleStyle: query.battleStyle,
      legal: query.legal,
      status: query.status,
      confidence: { $gte: query.minimumConfidence },
    };

    if (query.pokemonId) mongoQuery.pokemonId = query.pokemonId;
    if (query.formId) mongoQuery.formId = query.formId;
    if (query.requiredRole) mongoQuery.$or = [{ primaryRole: query.requiredRole }, { secondaryRoles: query.requiredRole }];
    if (query.archetype) mongoQuery.archetypes = query.archetype;

    const sets = await PokemonSet.find(mongoQuery)
      .sort({
        confidence: -1,
        coherenceScore: -1,
        sourceUpdatedAt: -1,
      })
      .limit(20)
      .exec();
    markMongoRead(sets.length);
    return sets;
  }
}
