import type { PokemonData } from '../core/AnalysisContext';

/**
 * Tipos de interação tática reconhecidos pelo analisador.
 * Cada tipo mapeia para um padrão mecânico de VGC verificável.
 */
export type TacticalInsightType =
  | 'weather_defense'       // Clima mitiga fraqueza de tipo (ex: chuva reduz Fire para Steel)
  | 'redirection_setup'     // Redirecionamento protege setup (ex: Rage Powder + Iron Defense)
  | 'immunity_coverage'     // Imunidade de tipo cobre fraqueza de parceiro (ex: Levitate contra Ground)
  | 'speed_conflict'        // Conflito entre controles de velocidade opostos (TR + Tailwind)
  | 'fake_out_setter'       // Fake Out garante ativação segura de TR/Tailwind/Terreno
  | 'ability_synergy'       // Sinergia de habilidade entre parceiros (ex: Hospitality + pivot)
  | 'swift_swim_rain'       // Swift Swim dobra velocidade sob chuva
  | 'slow_pivot'            // Volt Switch/U-turn lento sob TR funciona como pivot seguro
  | 'wide_guard_cover'      // Wide Guard protege parceiro de golpes spread
  | 'body_press_setup'      // Iron Defense + Body Press como condição de vitória defensiva
  | 'hybrid_axis_synergy';  // Sinergia de eixos híbridos (ex: Rain Room)

/**
 * Representa uma interação tática verificada entre Pokémon de uma equipe.
 *
 * Cada insight é gerado pelo TacticalInteractionAnalyzer cruzando
 * golpes, habilidades, tipos e stats reais dos membros do time.
 * O campo `verified` garante que o frontend nunca exiba informações
 * que não correspondam aos sets atuais.
 */
export type TacticalAvailability = 'active-now' | 'available-after-switch' | 'selected-but-inactive' | 'unavailable';

export interface TacticalInteractionContext {
  lead?: string[];
  backline?: string[];
}

export interface TacticalInsight {
  /** Tipo da interação mecânica detectada */
  type: TacticalInsightType;

  /** Nomes dos Pokémon envolvidos nesta interação */
  pokemonInvolved: string[];

  /** Habilidades participantes (ex: ['Drizzle', 'Filter']) */
  mechanicsUsed: string[];

  /** Golpes necessários para esta interação funcionar (ex: ['Iron Defense', 'Body Press']) */
  movesRequired: string[];

  /** Explicação verificada em português do Brasil */
  explanation_ptBR: string;

  /** Explicação verificada em inglês */
  explanation_enUS: string;

  /**
   * Se todos os golpes e habilidades necessários existem nos sets reais.
   * Quando false, o frontend deve exibir o insight em vermelho com os erros.
   */
  verified: boolean;

  /** Lista de recursos faltantes quando verified === false */
  missingResources: string[];

  /**
   * Importância tática desta interação (0-100).
   * Insights com score mais alto aparecem primeiro no playbook.
   */
  impactScore: number;

  availability?: TacticalAvailability;
  fieldRequirements?: {
    mustBeActive: string[];
    mustBeSelected: string[];
    requiredWeather?: string;
  };
  timing?: {
    earliestTurn: number;
    requiresSwitch: boolean;
    immediateFromLead: boolean;
  };
  reliabilityScore?: number;
}

/**
 * Definição de uma regra de detecção de interação tática.
 *
 * Cada regra recebe o time e retorna 0 ou mais insights.
 * O design por array de regras permite adicionar, remover ou
 * modificar regras sem alterar o motor principal.
 */
export interface TacticalRule {
  /** Identificador único da regra */
  id: string;

  /** Tipo de insight que esta regra produz */
  type: TacticalInsightType;

  /**
   * Função que analisa o time e retorna insights verificados.
   * Recebe o array de PokemonData (normalmente 4, o quarteto do modo)
   * e o formato para resolução de variantes.
   */
  analyze: (team: PokemonData[], format: string) => TacticalInsight[];
}
