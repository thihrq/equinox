import type { PokemonData } from '../core/AnalysisContext';

export interface VgcRequiredAction {
  actor: string;
  move: string;
  timing: 'turn-1' | 'after-switch' | 'any';
}

export interface VgcModeContract {
  selectedFour: string[];
  lead: string[];
  backline: string[];
  requiredActions?: VgcRequiredAction[];
}

export interface VgcModeContractValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function validateModeContract(
  contract: VgcModeContract,
  fullTeam: PokemonData[],
): VgcModeContractValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const selectedSet = new Set(contract.selectedFour);
  const leadSet = new Set(contract.lead);
  const backlineSet = new Set(contract.backline);

  if (contract.selectedFour.length !== 4) errors.push('A seleção do modo deve conter exatamente quatro Pokémon.');
  if (contract.lead.length !== 2) errors.push('A lead deve conter exatamente dois Pokémon.');
  if (contract.backline.length !== 2) errors.push('O banco deve conter exatamente dois Pokémon.');

  for (const name of contract.lead) {
    if (!selectedSet.has(name)) errors.push(`${name} está na lead, mas não pertence aos quatro selecionados.`);
  }
  for (const name of contract.backline) {
    if (!selectedSet.has(name)) errors.push(`${name} está no banco, mas não pertence aos quatro selecionados.`);
    if (leadSet.has(name)) errors.push(`${name} aparece simultaneamente na lead e no banco.`);
  }
  for (const name of contract.selectedFour) {
    if (!leadSet.has(name) && !backlineSet.has(name)) errors.push(`${name} não foi alocado na lead nem no banco.`);
  }

  const actionCount = new Map<string, number>();
  const activeMoves = new Map<string, string[]>();

  for (const action of contract.requiredActions ?? []) {
    const pokemon = fullTeam.find(member => normalize(member.name) === normalize(action.actor));
    if (!pokemon) {
      errors.push(`${action.actor} não existe no time.`);
      continue;
    }
    if (!selectedSet.has(pokemon.name)) errors.push(`${pokemon.name} não pertence aos quatro selecionados.`);

    const isTurn1 = action.timing === 'turn-1';
    
    // Regra: Pokémon ativo no turno
    if (isTurn1 && !leadSet.has(pokemon.name)) {
      errors.push(`${pokemon.name} não está ativo na lead no turno 1 para usar ${action.move}.`);
    }

    // Regra: Fake Out do banco
    if (normalize(action.move) === 'fakeout' && !leadSet.has(pokemon.name)) {
      errors.push(`${pokemon.name} não pode usar Fake Out a partir do banco de reservas no turno 1.`);
    }

    // Regra: Ações abstratas do sistema não são validadas como golpes
    const abstractMoves = ['protect', 'switch', 'switchin', 'switch-in', 'megaevolve', 'mega-evolve', 'none', 'none-action'];
    const isAbstract = abstractMoves.includes(normalize(action.move));

    if (!isAbstract) {
      const hasMove = (pokemon.moves ?? []).some(move => normalize(move) === normalize(action.move));
      if (!hasMove) {
        errors.push(`${pokemon.name} não possui o golpe ${action.move} no set.`);
      }
    }

    // Regra: Uma ação por Pokémon por turno
    if (isTurn1) {
      actionCount.set(pokemon.name, (actionCount.get(pokemon.name) ?? 0) + 1);
      
      const currentMoves = activeMoves.get(pokemon.name) ?? [];
      currentMoves.push(normalize(action.move));
      activeMoves.set(pokemon.name, currentMoves);
    }
  }

  for (const [actor, count] of actionCount) {
    if (count > 1) {
      errors.push(`${actor} recebeu mais de uma ação no mesmo turno.`);
    }
  }

  // Regra: Redirecionamento e Trick Room simultâneos do mesmo usuário
  for (const [actor, moves] of activeMoves) {
    const hasTR = moves.includes('trickroom') || moves.includes('trick-room');
    const hasRedirect = moves.includes('ragepowder') || moves.includes('rage-powder') || moves.includes('followme') || moves.includes('follow-me');
    if (hasTR && hasRedirect) {
      errors.push(`${actor} não pode ativar Trick Room e redirecionamento simultaneamente no mesmo turno.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
