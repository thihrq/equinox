import { ValidatedCompetitiveSetRepository, ValidatedCompetitiveSetEntry } from './ValidatedCompetitiveSetRepository';

export interface ResolvedCoreMember {
  inputName: string;
  matchedSet?: ValidatedCompetitiveSetEntry;
  validationStatus: 'validated' | 'user-supplied-unvalidated' | 'not-found';
  reasonCode: string;
}

export interface UserCoreResolutionResult {
  overallStatus: 'validated' | 'partially-validated' | 'unvalidated';
  members: ResolvedCoreMember[];
  reasonCodes: string[];
}

export class UserCoreResolver {
  private repository: ValidatedCompetitiveSetRepository;

  constructor(repository?: ValidatedCompetitiveSetRepository) {
    this.repository = repository || ValidatedCompetitiveSetRepository.getInstance();
  }

  public resolveCore(coreInputNames: string[]): UserCoreResolutionResult {
    const members: ResolvedCoreMember[] = [];
    const overallReasonCodes: string[] = [];
    let validatedCount = 0;

    for (const name of coreInputNames) {
      if (!name || !name.trim()) {
        members.push({
          inputName: name,
          validationStatus: 'not-found',
          reasonCode: 'USER_CORE_SET_INCOMPLETE',
        });
        overallReasonCodes.push('USER_CORE_SET_INCOMPLETE');
        continue;
      }

      const sets = this.repository.getByPokemonId(name);

      if (sets.length === 1) {
        members.push({
          inputName: name,
          matchedSet: sets[0],
          validationStatus: 'validated',
          reasonCode: 'USER_CORE_VALIDATED_SET_SELECTED',
        });
        validatedCount++;
        overallReasonCodes.push('USER_CORE_VALIDATED_SET_SELECTED');
      } else if (sets.length > 1) {
        members.push({
          inputName: name,
          matchedSet: sets[0], // Seleciona a primeira variante e preserva as demais em metadata
          validationStatus: 'validated',
          reasonCode: 'USER_CORE_MULTIPLE_VALIDATED_SETS',
        });
        validatedCount++;
        overallReasonCodes.push('USER_CORE_MULTIPLE_VALIDATED_SETS');
      } else {
        members.push({
          inputName: name,
          validationStatus: 'user-supplied-unvalidated',
          reasonCode: 'USER_CORE_VALIDATED_SET_NOT_FOUND',
        });
        overallReasonCodes.push('USER_CORE_VALIDATED_SET_NOT_FOUND');
      }
    }

    let overallStatus: 'validated' | 'partially-validated' | 'unvalidated' = 'unvalidated';

    if (validatedCount === coreInputNames.length && coreInputNames.length > 0) {
      overallStatus = 'validated';
    } else if (validatedCount > 0) {
      overallStatus = 'partially-validated';
    }

    return {
      overallStatus,
      members,
      reasonCodes: Array.from(new Set(overallReasonCodes)),
    };
  }
}
