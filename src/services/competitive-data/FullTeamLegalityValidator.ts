export interface TeamMemberInput {
  name: string;
  species?: string;
  item?: string;
  ability?: string;
  moves?: string[];
  candidateId?: string;
  packageEntryDigest?: string;
}

export interface FullTeamLegalityResult {
  legal: boolean;
  reasonCodes: string[];
  errors: string[];
}

export class FullTeamLegalityValidator {
  public static validate(team: TeamMemberInput[]): FullTeamLegalityResult {
    const reasonCodes: string[] = [];
    const errors: string[] = [];

    // 1. Número de membros (deve ser exatamente 6)
    if (!team || team.length !== 6) {
      reasonCodes.push('FULL_TEAM_MEMBER_COUNT_INVALID');
      errors.push(`O time completo deve conter exatamente 6 membros (fornecido: ${team?.length || 0})`);
    }

    if (!team || team.length === 0) {
      return { legal: false, reasonCodes, errors };
    }

    // 2. Species Clause (sem espécies duplicadas no time de 6)
    const speciesSeen = new Set<string>();
    for (const member of team) {
      const speciesName = (member.species || member.name || '').toLowerCase().split('-')[0].trim();
      if (speciesName) {
        if (speciesSeen.has(speciesName)) {
          reasonCodes.push('FULL_TEAM_SPECIES_CLAUSE_VIOLATION');
          errors.push(`Violação da Species Clause: espécie '${member.name}' duplicada no time.`);
        }
        speciesSeen.add(speciesName);
      }
    }

    // 3. Item Clause (todos os 6 itens devem ser únicos em formatos oficiais)
    const itemsSeen = new Set<string>();
    for (const member of team) {
      const item = member.item?.toLowerCase().trim();
      if (item && item !== 'none' && item !== '—' && item !== '') {
        if (itemsSeen.has(item)) {
          reasonCodes.push('FULL_TEAM_ITEM_CLAUSE_VIOLATION');
          errors.push(`Violação da Item Clause: item '${member.item}' duplicado no time.`);
        }
        itemsSeen.add(item);
      }
    }

    // 4. Limite de Mega Evolução (no máximo 1 Mega por time)
    const megaCount = team.filter(m => /-mega/i.test(m.name || '') || /-mega/i.test(m.species || '')).length;
    if (megaCount > 1) {
      reasonCodes.push('FULL_TEAM_MEGA_LIMIT_VIOLATION');
      errors.push(`Violação do Limite de Mega Evoluções: encontrado(s) ${megaCount} Mega Pokémon no time (máximo permitido: 1).`);
    }

    const legal = reasonCodes.length === 0;

    return {
      legal,
      reasonCodes: Array.from(new Set(reasonCodes)),
      errors,
    };
  }
}
