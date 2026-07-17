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
  /**
   * Teto de candidatos considerados no pré-filtro combinatório de trios
   * (busca O(n³) em CombinationSearchEngine, que roda por completo antes de
   * aplicar maxPipelineEvaluations). Sem teto (Infinity) para não mudar o
   * comportamento de perfis já validados; reduzido apenas onde a
   * combinatória se provou cara demais para o CPU do Render Free.
   */
  maxPreFilterCandidates: number;
  /**
   * Wall-clock budget (ms) for the same pré-filtro loop. O teto de
   * candidatos sozinho se provou insuficiente em produção (ainda >60s com
   * 220 combinações sob CPU throttling do Render Free) — este é o limite
   * real, pois se adapta à velocidade de CPU do momento em vez de um
   * palpite fixo. Infinity nos perfis não afetados.
   */
  maxPreFilterTimeMs: number;
  /** Mesma ideia, mas para a fase de pipeline completo (maxPipelineEvaluations). */
  maxPipelineTimeMs: number;
  note: string;
}

const clampRatio = (value: number): number => Math.max(0.55, Math.min(0.95, value));

function applyRuntimeProfile(profile: FormatPerformanceProfile): FormatPerformanceProfile {
  if (appConfig.runtimeProfile !== 'render_free') {
    return profile;
  }

  const limitsByProfile: Record<string, Partial<FormatPerformanceProfile>> = {
    'radical-red-gauntlet-performance': {
      maxPipelineEvaluations: 48,
      maxCombinationsToKeep: 12,
      anchorCandidateLimit: 6,
      perAnchorCombinations: 2,
      exploitationRatio: 0.94,
    },
    'champions-doubles-performance': {
      maxPipelineEvaluations: 64,
      maxCombinationsToKeep: 16,
      anchorCandidateLimit: 7,
      perAnchorCombinations: 3,
      exploitationRatio: 0.9,
      // Incidente real 2026-07-17: pré-filtro O(n³) sobre 28 candidatos
      // (C(28,3)=3.276 avaliações síncronas de plano/mecânica VGC) travou o
      // event loop inteiro no Render Free por vários minutos. C(12,3)=220
      // mantém o pré-filtro na mesma ordem de grandeza do orçamento de
      // pipeline completo (64) acima, sem esvaziar o espaço de busca.
      maxPreFilterCandidates: 12,
      // Mesmo com o teto acima, uma tentativa real ainda estourou 60s+ sob
      // throttling do Render Free — o teto de tempo é o limite que
      // realmente garante latência máxima previsível.
      maxPreFilterTimeMs: 2500,
      maxPipelineTimeMs: 2500,
    },
    'champions-singles-performance': {
      maxPipelineEvaluations: 64,
      maxCombinationsToKeep: 16,
      anchorCandidateLimit: 7,
      perAnchorCombinations: 3,
      exploitationRatio: 0.88,
    },
    'vanilla-game-performance': {
      maxPipelineEvaluations: 90,
      maxCombinationsToKeep: 24,
      anchorCandidateLimit: 8,
      perAnchorCombinations: 4,
      exploitationRatio: 0.86,
    },
    'meta-ladder-performance': {
      maxPipelineEvaluations: 110,
      maxCombinationsToKeep: 28,
      anchorCandidateLimit: 10,
      perAnchorCombinations: 4,
      exploitationRatio: 0.84,
    },
    'default-performance': {
      maxPipelineEvaluations: 72,
      maxCombinationsToKeep: 18,
      anchorCandidateLimit: 8,
      perAnchorCombinations: 3,
      exploitationRatio: 0.84,
    },
  };

  const overrides = limitsByProfile[profile.id] ?? limitsByProfile['default-performance'];

  return {
    ...profile,
    ...overrides,
    note: `${profile.note} Perfil render_free ativo: orçamento reduzido de forma agressiva para evitar 502/timeouts no Render Free.`,
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
        maxPreFilterCandidates: Infinity,
        maxPreFilterTimeMs: Infinity,
        maxPipelineTimeMs: Infinity,
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
        maxPipelineEvaluations: isDoubles ? 8 : 120,
        exploitationRatio: clampRatio(isDoubles ? 0.94 : 0.9),
        maxCombinationsToKeep: isDoubles ? 10 : 40,
        anchorCandidateLimit: isDoubles ? 4 : 10,
        perAnchorCombinations: isDoubles ? 1 : 3,
        maxPreFilterCandidates: Infinity,
        maxPreFilterTimeMs: Infinity,
        maxPipelineTimeMs: Infinity,
        note: 'Usa pré-ranking VGC leve de plano 6/4/leads, preserva o arquétipo e hidrata apenas finalistas para reduzir latência em fluxo interativo.',
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
        maxPreFilterCandidates: Infinity,
        maxPreFilterTimeMs: Infinity,
        maxPipelineTimeMs: Infinity,
        note: 'Perfis Vanilla por jogo usam pools menores e ameaça limitada ao escopo da geração, então não precisam da busca ampla de ladder.',
      });
    }

    if (intelligence.gameFamily === 'smogon' || intelligence.id === 'national_dex') {
      return applyRuntimeProfile({
        id: 'champions-singles-performance',
        label: 'Pokémon Champions Singles Performance Guardrail',
        maxPipelineEvaluations: 120,
        exploitationRatio: 0.9,
        maxCombinationsToKeep: 40,
        anchorCandidateLimit: 10,
        perAnchorCombinations: 3,
        maxPreFilterCandidates: Infinity,
        maxPreFilterTimeMs: Infinity,
        maxPipelineTimeMs: Infinity,
        note: 'Showdown/National Dex saiu do escopo do produto; aliases legados usam o solver de Champions Singles como fallback seguro.',
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
      maxPreFilterCandidates: Infinity,
      maxPreFilterTimeMs: Infinity,
      maxPipelineTimeMs: Infinity,
      note: 'Perfil padrão para formatos genéricos sem data pack pesado.',
    });
  }
}
