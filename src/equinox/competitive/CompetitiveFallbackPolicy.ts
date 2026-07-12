export type CompetitiveFallbackLevel =
  | 'curated-regulation'
  | 'observed-current'
  | 'compatible-doubles'
  | 'role-preset'
  | 'generic-fallback';

export interface CompetitiveFallbackDecision {
  level: CompetitiveFallbackLevel;
  label: 'Curado' | 'Dados competitivos atuais' | 'Preset por funcao' | 'Fallback experimental';
  confidencePenalty: number;
  warning?: string;
}

export function classifyCompetitiveFallback(input: {
  sourceType?: string;
  regulationExact: boolean;
  current: boolean;
  battleStyle: 'singles' | 'doubles';
  generated?: boolean;
}): CompetitiveFallbackDecision {
  if (input.sourceType === 'curated' && input.regulationExact) {
    return { level: 'curated-regulation', label: 'Curado', confidencePenalty: 0 };
  }
  if (input.current && input.sourceType === 'usage-stats') {
    return { level: 'observed-current', label: 'Dados competitivos atuais', confidencePenalty: 4 };
  }
  if (input.battleStyle === 'doubles' && !input.generated) {
    return { level: 'compatible-doubles', label: 'Dados competitivos atuais', confidencePenalty: 8 };
  }
  if (input.generated) {
    return {
      level: 'role-preset',
      label: 'Preset por funcao',
      confidencePenalty: 18,
      warning: 'Preset generated because no trusted contextual set exists.',
    };
  }
  return {
    level: 'generic-fallback',
    label: 'Fallback experimental',
    confidencePenalty: 30,
    warning: 'Generic fallback used because no reliable set exists.',
  };
}
