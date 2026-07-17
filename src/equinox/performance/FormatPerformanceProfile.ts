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
   * Orçamento de tempo (ms) para o pré-filtro combinatório de trios (busca
   * O(n³) em CombinationSearchEngine, que roda antes de aplicar
   * maxPipelineEvaluations). Um teto de *contagem* de candidatos foi
   * tentado primeiro e causou um bug real: cortar para os N candidatos
   * mais bem pontuados pode produzir um pool homogêneo demais para
   * satisfazer restrições de composição (incidente 2026-07-17 — os 12
   * melhores candidatos para um time com viés de chuva eram todos do tipo
   * Water, tornando impossível achar qualquer trio válido). Um orçamento
   * de tempo deixa o laço explorar candidatos mais diversos mais abaixo na
   * lista, e se adapta à velocidade real de CPU em vez de um palpite fixo.
   * Infinity nos perfis não afetados.
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
      // event loop inteiro no Render Free por vários minutos. Um teto de
      // *contagem* de candidatos (tentativa anterior, revertida) causou
      // outro bug: cortar para os N mais bem pontuados pode produzir um
      // pool homogêneo demais para passar nas restrições de composição.
      // O orçamento de tempo abaixo, combinado com yield periódico do
      // event loop (ver CombinationSearchEngine.yieldEventLoop), é o
      // limite real — deixa o laço avançar por candidatos mais diversos
      // sem travar o health check do Render (timeout de 5s).
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
      maxPreFilterTimeMs: Infinity,
      maxPipelineTimeMs: Infinity,
      note: 'Perfil padrão para formatos genéricos sem data pack pesado.',
    });
  }
}
