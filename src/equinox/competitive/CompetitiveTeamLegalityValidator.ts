import { PokemonData } from '../core/AnalysisContext';
import { getSpeciesClauseKey } from '../utils/PokemonUtils';
import { isMegaOption, isMegaStone } from '../utils/VgcSetOptimizer';
import { validateCompetitivePokemonSet, withCompetitiveSet } from './CompetitivePokemonSet';

export interface TeamLegalityIssue {
  code: string;
  severity: 'error' | 'warning';
  pokemon?: string[];
  message: string;
}

export interface TeamLegalityResult {
  legal: boolean;
  issues: TeamLegalityIssue[];
}

const normalize = (value?: string): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function countBy<T>(values: T[], keyOf: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return grouped;
}

export function validateCompetitiveTeam(
  team: PokemonData[],
  format: string,
): TeamLegalityResult {
  const issues: TeamLegalityIssue[] = [];

  if (team.length !== 6) {
    issues.push({
      code: 'TEAM_SIZE',
      severity: 'error',
      message: `O time competitivo deve conter 6 Pokemon; recebido ${team.length}.`,
    });
  }

  const resolvedTeam = team.map(member =>
    member.competitiveSet ? member : withCompetitiveSet(member, format),
  );

  for (const member of resolvedTeam) {
    const validation = validateCompetitivePokemonSet(member.competitiveSet!);
    if (!validation.legal) {
      issues.push({
        code: 'INCOMPLETE_SET',
        severity: 'error',
        pokemon: [member.name],
        message: `${member.name} possui set incompleto: ${validation.errors.join(' ')}`,
      });
    }
    for (const warning of validation.warnings) {
      issues.push({
        code: 'SET_WARNING',
        severity: 'warning',
        pokemon: [member.name],
        message: `${member.name}: ${warning}`,
      });
    }
  }

  const speciesGroups = countBy(resolvedTeam, member => getSpeciesClauseKey(member.name));
  for (const group of speciesGroups.values()) {
    if (group.length > 1) {
      issues.push({
        code: 'SPECIES_CLAUSE',
        severity: 'error',
        pokemon: group.map(member => member.name),
        message: `Species Clause violada por ${group.map(member => member.name).join(', ')}.`,
      });
    }
  }

  const itemGroups = countBy(
    resolvedTeam.filter(member => member.item && !isMegaStone(member.item)),
    member => normalize(member.item),
  );
  for (const group of itemGroups.values()) {
    if (group.length > 1) {
      issues.push({
        code: 'ITEM_CLAUSE',
        severity: 'error',
        pokemon: group.map(member => member.name),
        message: `Item Clause violada: ${group[0].item} aparece em ${group.map(member => member.name).join(', ')}.`,
      });
    }
  }

  const megaUsers = resolvedTeam.filter(isMegaOption);
  if (megaUsers.length > 1) {
    issues.push({
      code: 'MEGA_LIMIT',
      severity: 'error',
      pokemon: megaUsers.map(member => member.name),
      message: `Limite de Mega Evolution excedido: ${megaUsers.map(member => member.name).join(', ')}.`,
    });
  }

  return {
    legal: issues.every(issue => issue.severity !== 'error'),
    issues,
  };
}

export function hasDuplicateItem(
  partialTeam: PokemonData[],
  candidate: PokemonData,
): boolean {
  const item = normalize(candidate.item);
  if (!item || isMegaStone(candidate.item)) return false;
  return partialTeam.some(member => normalize(member.item) === item && !isMegaStone(member.item));
}
