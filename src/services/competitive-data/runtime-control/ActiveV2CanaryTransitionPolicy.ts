import type { ActiveV2CanaryMode } from './ActiveV2CanaryConfigTypes';

export type ActiveV2CanaryApprovalTier = 'single-responsible' | 'registered-review' | 'two-person' | 'executive';

export interface ActiveV2CanaryTransitionRequirement {
  tier: ActiveV2CanaryApprovalTier;
  requiredApproverCount: 1 | 2;
  requiresExecutiveApproval: boolean;
  description: string;
}

/**
 * Classifica quantas aprovações uma transição de modo/percentual de canário
 * exige, seguindo a tabela de controle de quatro olhos (adendo 4.2). A
 * classificação é feita pelo alvo (targetMode/targetPercentage), não pela
 * origem — pular etapas (ex: off -> 25% direto) nunca reduz o rigor exigido
 * pelo percentual de destino.
 */
export function classifyActiveV2CanaryTransition(
  targetMode: ActiveV2CanaryMode,
  targetPercentage: number | null
): ActiveV2CanaryTransitionRequirement {
  if (targetMode === 'off' || targetMode === 'shadow' || targetMode === 'internal') {
    return {
      tier: 'single-responsible',
      requiredApproverCount: 1,
      requiresExecutiveApproval: false,
      description: `Transição para modo "${targetMode}": 1 responsável autorizado`,
    };
  }

  if (targetMode === 'full') {
    return {
      tier: 'executive',
      requiredApproverCount: 2,
      requiresExecutiveApproval: true,
      description: 'Transição para rollout 100% (full): aprovação técnica de duas pessoas + aprovação executiva definida',
    };
  }

  // targetMode === 'percentage'
  if (targetPercentage === null || targetPercentage < 0 || targetPercentage > 100) {
    throw new Error('CANARY_TRANSITION_INVALID: targetPercentage deve ser um número entre 0 e 100 quando targetMode = "percentage"');
  }

  if (targetPercentage <= 10) {
    return {
      tier: 'registered-review',
      requiredApproverCount: 1,
      requiresExecutiveApproval: false,
      description: `Transição para ${targetPercentage}%: revisão registrada (1 responsável)`,
    };
  }

  return {
    tier: 'two-person',
    requiredApproverCount: 2,
    requiresExecutiveApproval: false,
    description: `Transição para ${targetPercentage}%: aprovação de duas pessoas (acima de 10%)`,
  };
}
