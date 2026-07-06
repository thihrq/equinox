import { appConfig } from '../../config/env';
import { FormatIntelligenceRegistry } from '../formats/FormatIntelligenceRegistry';

export interface FormatPerformanceProfile {
  id: string;
  label: string;
  maxPipelineEvaluations: number;
  exploitationRatio: number;
  maxCombinationsToKeep: number;
  anchorCandidateLimit: number;
  perAnchorCombinations: number;
  note: string;
}

const clampRatio = (value: number): number => Math.max(0.55, Math.min(0.95, value));

function applyRuntimeProfile(profile: FormatPerformanceProfile): FormatPerformanceProfile {
  if (appConfig.runtimeProfile !== 'render_free') {
    return profile;
  }

  const limitsByProfile: Record<string, Partial<FormatPerformanceProfile>> = {
    'radical-red-gauntlet-performance': {
      maxPipelineEvaluations: 900,
      maxCombinationsToKeep: 120,
      anchorCandidateLimit: 14,
      perAnchorCombinations: 7,
      exploitationRatio: 0.92,
    },
    'champions-doubles-performance': {
      maxPipelineEvaluations: 1400,
      maxCombinationsToKeep: 160,
      anchorCandidateLimit: 18,
      perAnchorCombinations: 8,
      exploitationRatio: 0.88,
    },
    'champions-singles-performance': {
      maxPipelineEvaluations: 1500,
      maxCombinationsToKeep: 170,
      anchorCandidateLimit: 18,
      perAnchorCombinations: 9,
      exploitationRatio: 0.86,
    },
    'vanilla-game-performance': {
      maxPipelineEvaluations: 1400,
      maxCombinationsToKeep: 170,
      anchorCandidateLimit: 18,
      perAnchorCombinations: 8,
      exploitationRatio: 0.84,
    },
    'meta-ladder-performance': {
      maxPipelineEvaluations: 2400,
      maxCombinationsToKeep: 220,
      anchorCandidateLimit: 20,
      perAnchorCombinations: 10,
      exploitationRatio: 0.82,
    },
    'default-performance': {
      maxPipelineEvaluations: 1600,
      maxCombinationsToKeep: 180,
      anchorCandidateLimit: 18,
      perAnchorCombinations: 8,
      exploitationRatio: 0.82,
    },
  };

  const overrides = limitsByProfile[profile.id] ?? limitsByProfile['default-performance'];

  return {
    ...profile,
    ...overrides,
    note: `${profile.note} Perfil render_free ativo: orçamento reduzido para evitar timeout no Render Free.`,
  };
}

export class FormatPerformanceProfileRegistry {
  private readonly formatRegistry = new FormatIntelligenceRegistry();

  public getProfile(format: string): FormatPerformanceProfile {
    const intelligence = this.formatRegistry.getProfile(format);

    if (intelligence.gameFamily === 'radical_red') {
      return applyRuntimeProfile({
        id: 'radical-red-gauntlet-performance',
        label: 'Radical Red Gauntlet Performance Guardrail',
        maxPipelineEvaluations: 2200,
        exploitationRatio: 0.9,
        maxCombinationsToKeep: 180,
        anchorCandidateLimit: 18,
        perAnchorCombinations: 10,
        note: 'Prioriza trios já fortes contra a gauntlet Hardcore e evita rodar pipeline completo em milhares de composições redundantes.',
      });
    }

    if (intelligence.gameFamily === 'pokemon_champions') {
      const isDoubles = intelligence.battleStyle === 'doubles';

      return applyRuntimeProfile({
        id: isDoubles ? 'champions-doubles-performance' : 'champions-singles-performance',
        label: isDoubles
          ? 'Pokémon Champions Doubles Performance Guardrail'
          : 'Pokémon Champions Singles Performance Guardrail',
        maxPipelineEvaluations: isDoubles ? 3200 : 3600,
        exploitationRatio: clampRatio(isDoubles ? 0.86 : 0.84),
        maxCombinationsToKeep: 220,
        anchorCandidateLimit: isDoubles ? 22 : 24,
        perAnchorCombinations: isDoubles ? 12 : 14,
        note: 'Mantém diversidade suficiente para regulação viva, mas reduz avaliações completas quando o source pack já define ameaças e arquétipos.',
      });
    }

    if (intelligence.gameFamily === 'core' && intelligence.id.startsWith('vanilla_')) {
      return applyRuntimeProfile({
        id: 'vanilla-game-performance',
        label: 'Vanilla Game Pool Performance Guardrail',
        maxPipelineEvaluations: 4200,
        exploitationRatio: 0.8,
        maxCombinationsToKeep: 240,
        anchorCandidateLimit: 24,
        perAnchorCombinations: 14,
        note: 'Perfis Vanilla por jogo usam pools menores e ameaça limitada ao escopo da geração, então não precisam da busca ampla de ladder.',
      });
    }

    if (intelligence.gameFamily === 'smogon' || intelligence.id === 'national_dex') {
      return applyRuntimeProfile({
        id: 'meta-ladder-performance',
        label: 'Meta Ladder Performance Guardrail',
        maxPipelineEvaluations: 6500,
        exploitationRatio: 0.78,
        maxCombinationsToKeep: 300,
        anchorCandidateLimit: 24,
        perAnchorCombinations: 18,
        note: 'Ladders competitivas preservam uma busca mais ampla por diversidade de cores ofensivas, defensivas e anti-meta.',
      });
    }

    return applyRuntimeProfile({
      id: 'default-performance',
      label: 'Default Performance Guardrail',
      maxPipelineEvaluations: 5200,
      exploitationRatio: 0.78,
      maxCombinationsToKeep: 260,
      anchorCandidateLimit: 24,
      perAnchorCombinations: 16,
      note: 'Perfil padrão para formatos genéricos sem data pack pesado.',
    });
  }
}
