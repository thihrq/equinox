import { PublicNoStrategyDiagnostic } from './PublicFailClosedDiagnostic';

export interface FailClosedTranslation {
  title: string;
  subtitle: string;
  reasonsHeader: string;
  recoveryHeader: string;
  suggestedAction: string;
  reasons: string[];
}

export function getFailClosedUiMessages(
  diagnostics: readonly PublicNoStrategyDiagnostic[],
  lang: 'pt-BR' | 'en-US' = 'pt-BR',
): FailClosedTranslation {
  const isPt = lang === 'pt-BR';

  const title = isPt
    ? 'Nenhuma composição competitivamente segura foi encontrada'
    : 'No competitively safe composition was found';

  const subtitle = isPt
    ? 'O Equinox avaliou as opções disponíveis e preservou os critérios de legalidade, qualidade defensiva e coerência dos sets.'
    : 'Equinox evaluated the available options and preserved legality, defensive quality, and set coherence criteria.';

  const reasonsHeader = isPt ? 'Principais motivos:' : 'Primary reasons:';
  const recoveryHeader = isPt ? 'Busca por recuperação:' : 'Recovery search:';

  const suggestedAction = isPt
    ? 'Recomendação: Experimente trocar um dos Pokémon da lead ou alterar o formato.'
    : 'Recommendation: Try swapping one of the lead Pokémon or changing the format.';

  const reasons: string[] = diagnostics.map(d => {
    switch (d.code) {
      case 'UNANSWERED_TYPE_WEAKNESS':
        return isPt
          ? `Fraqueza acumulada a ${d.attackType || 'tipo'} sem uma resposta defensiva segura.`
          : `Accumulated weakness to ${d.attackType || 'type'} without a safe defensive answer.`;
      case 'NO_SAFE_SWITCH_IN':
        return isPt
          ? `Nenhum Pokémon disponível conseguiu entrar com segurança contra essa ameaça.`
          : `No available Pokémon could switch safely into this threat.`;
      case 'CRITICAL_SPREAD_EXPOSURE':
        return isPt
          ? `A composição permaneceu muito vulnerável a golpes em área.`
          : `The composition remained highly vulnerable to spread moves.`;
      case 'MISSING_REQUIRED_ROLE':
        return isPt
          ? `As opções avaliadas não cobriram uma função estratégica necessária.`
          : `The evaluated options did not cover a required strategic role.`;
      case 'CANDIDATE_SOURCE_EXHAUSTED':
        return isPt
          ? `O conjunto atual de candidatos foi esgotado sem encontrar uma composição segura.`
          : `The current candidate pool was exhausted without finding a safe composition.`;
      default:
        return isPt
          ? `Critérios de qualidade defensiva ou coerência de sets não atendidos.`
          : `Defensive quality or set coherence criteria were not satisfied.`;
    }
  });

  return {
    title,
    subtitle,
    reasonsHeader,
    recoveryHeader,
    suggestedAction,
    reasons,
  };
}
